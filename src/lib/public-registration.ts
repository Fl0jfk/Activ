import { clerkClient } from "@clerk/nextjs/server";
import { buildMemberClerkMetadata, tryDeleteClerkUser } from "@/lib/clerk";
import { parseClerkError } from "@/lib/clerk-errors";
import {
  readClubData,
  type ClubData,
  type RegistrationApplication,
  type TrialSlot,
} from "@/lib/club-data";
import { abortWrite, runClubTransaction } from "@/lib/club-data-tx";
import {
  consumeVerifiedEmailCode,
  findEmailVerificationProof,
  findVerifiedEmailCode,
} from "@/lib/email-verification";
import type { MembershipBulletinData } from "@/lib/membership-bulletin";
import {
  buildClubMemberRecord,
  buildRegistrationApplication,
  findActiveApplicationByEmail,
} from "@/lib/registration-application";
import { randomId } from "@/lib/ids";
import { deleteStoredDocument, type UploadedDocument } from "@/lib/s3-upload";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

/** Échec « métier » dont le message peut être montré tel quel au public. */
export class RegistrationFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "RegistrationFailure";
  }
}

export type RegistrationOutcome =
  | { kind: "created"; application: RegistrationApplication; trialSlots: TrialSlot[] }
  | { kind: "already_received" }
  | { kind: "error"; failure: RegistrationFailure };

const NOT_VERIFIED_MESSAGE =
  "Confirmez votre adresse e-mail avec le code reçu avant d'envoyer votre demande.";
const VERIFICATION_USED_MESSAGE =
  "Cette confirmation d'adresse e-mail a déjà été utilisée. Demandez un nouveau code pour continuer.";
const EXISTING_ACCOUNT_MESSAGE =
  "Un compte existe déjà avec cette adresse e-mail. Connectez-vous à votre espace adhérent (même si vous avez été désinscrit(e) : vous y trouverez « Déposer une nouvelle pré-inscription »), ou utilisez « Mot de passe oublié ». Si le problème persiste, contactez le bureau.";
const SERVER_ERROR_MESSAGE =
  "Votre inscription n'a pas pu être enregistrée. Aucune donnée n'a été conservée : vous pouvez réessayer dans quelques instants.";

function failure(message: string, status: number, code?: string, fieldErrors?: Record<string, string>) {
  return { kind: "error" as const, failure: new RegistrationFailure(message, status, code, fieldErrors) };
}

/** Résumé d'une erreur sans donnée personnelle, pour les journaux. */
export function describeErrorForLog(error: unknown): Record<string, unknown> {
  const candidate = error as {
    name?: string;
    status?: number;
    errors?: { code?: string }[];
  } | null;
  return {
    name: candidate?.name,
    status: candidate?.status,
    code: candidate?.errors?.[0]?.code,
  };
}

const emailLocks = new Map<string, Promise<unknown>>();

/** Fait passer l'une après l'autre les demandes simultanées pour une même adresse (double clic, renvoi). */
async function withEmailLock<T>(email: string, task: () => Promise<T>): Promise<T> {
  const previous = emailLocks.get(email) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  emailLocks.set(email, tail);
  try {
    return await run;
  } finally {
    if (emailLocks.get(email) === tail) emailLocks.delete(email);
  }
}

/**
 * Contrôle sans effet de bord : la vérification d'adresse vient-elle d'être prouvée, et le dossier existe-t-il déjà ?
 * L'ordre compte : la preuve de propriété de l'adresse passe avant toute réponse « déjà reçu ».
 */
export async function checkVerificationAndDuplicate(
  email: string,
  verificationId: unknown,
  loaded?: ClubData,
): Promise<Exclude<RegistrationOutcome, { kind: "created" }> | null> {
  const data = loaded ?? (await readClubData());
  const proof = findEmailVerificationProof(data, email, verificationId);
  if (!proof) return failure(NOT_VERIFIED_MESSAGE, 400, "email_not_verified");
  if (findActiveApplicationByEmail(data.applications, email)) return { kind: "already_received" };
  if (proof.consumedAt) return failure(VERIFICATION_USED_MESSAGE, 400, "email_not_verified");
  return null;
}

/**
 * Un compte ou un dossier actif existe-t-il pour cette adresse ?
 * À ne révéler qu'une fois la propriété de l'adresse prouvée par le code reçu.
 */
export async function accountExistsForEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const data = await readClubData();
  if (findActiveApplicationByEmail(data.applications, normalized)) return true;
  try {
    const client = await clerkClient();
    const existing = await client.users.getUserList({ emailAddress: [normalized], limit: 1 });
    return existing.data.length > 0;
  } catch (error) {
    console.error("Recherche Clerk impossible", describeErrorForLog(error));
    return false;
  }
}

const PASSWORD_ERROR_CODES = new Set([
  "form_password_pwned",
  "form_password_length_too_short",
  "form_password_not_strong_enough",
  "form_password_size_in_bytes_exceeded",
  "form_password_validation_failed",
]);

function mapClerkCreateError(error: unknown): Exclude<RegistrationOutcome, { kind: "created" }> {
  const candidate = error as {
    status?: number;
    errors?: { code?: string; meta?: { paramName?: string; name?: string } }[];
  } | null;
  const first = candidate?.errors?.[0];
  const code = first?.code ?? "";
  const param = first?.meta?.paramName ?? first?.meta?.name ?? "";
  const parsed = parseClerkError(error);

  if (code === "form_identifier_exists" || parsed.status === 409) {
    return failure(EXISTING_ACCOUNT_MESSAGE, 409, "existing_account");
  }
  if (PASSWORD_ERROR_CODES.has(code) || (code === "form_param_format_invalid" && /password/i.test(param))) {
    return failure(parsed.message, 400, "password_invalid", { password: parsed.message });
  }
  if (code === "form_param_format_invalid" && /email/i.test(param)) {
    return failure("Adresse e-mail invalide.", 400, "validation", { email: "Adresse e-mail invalide." });
  }
  console.error("Clerk createUser a échoué", describeErrorForLog(error));
  if (candidate?.status === 429) {
    return failure(
      "Le service d'inscription est très sollicité en ce moment. Réessayez dans quelques minutes.",
      503,
      "server_error",
    );
  }
  return failure(SERVER_ERROR_MESSAGE, 502, "server_error");
}

export type RegisterResult<T> =
  | Exclude<RegistrationOutcome, { kind: "created" }>
  | (Extract<RegistrationOutcome, { kind: "created" }> & { artifacts: T });

export type PreparedRegistration<T> = {
  documents: UploadedDocument[];
  membershipBulletin: MembershipBulletinData | null;
  /** Données à conserver pour les e-mails (ex. le PDF). */
  artifacts: T;
};

export type RegistrationInput = {
  email: string;
  verificationId: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  disciplineId: string;
  disciplineIds: string[];
  trialSlotId: string | null;
  motivation: string;
};

/**
 * Crée le compte Clerk et le dossier d'inscription, pour le bulletin comme pour la réservation d'essai.
 *
 * Ordre : preuve de l'adresse et doublon → contrôle du créneau → travail lent (`prepare` : PDF, envoi de fichiers)
 * → création du compte → enregistrement du dossier sous verrou (doublon, créneau et vérification contrôlés de nouveau).
 * Au moindre échec après la création du compte, le compte et les fichiers envoyés sont supprimés.
 */
export async function registerApplicant<T>(
  input: RegistrationInput,
  prepare: (applicationId: string) => Promise<PreparedRegistration<T>>,
): Promise<RegisterResult<T>> {
  const email = input.email.trim().toLowerCase();
  return withEmailLock(email, async () => {
    const initialData = await readClubData();
    const early = await checkVerificationAndDuplicate(email, input.verificationId, initialData);
    if (early) return early;

    if (input.trialSlotId) {
      const slotCheck = validateTrialSlotForRegistration(initialData, {
        disciplineId: input.disciplineId,
        trialSlotId: input.trialSlotId,
      });
      if (!slotCheck.ok) return failure(slotCheck.message, slotCheck.status, "slot_unavailable");
    }

    const client = await clerkClient();

    // Un compte Clerk existe déjà et aucun dossier actif : inutile de refaire tout le travail.
    try {
      const existing = await client.users.getUserList({ emailAddress: [email], limit: 1 });
      if (existing.data.length > 0) return failure(EXISTING_ACCOUNT_MESSAGE, 409, "existing_account");
    } catch (error) {
      console.error("Recherche Clerk impossible avant création", describeErrorForLog(error));
    }

    const applicationId = randomId("app");
    let prepared: PreparedRegistration<T>;
    try {
      prepared = await prepare(applicationId);
    } catch (error) {
      if (error instanceof RegistrationFailure) {
        return { kind: "error", failure: error };
      }
      throw error;
    }

    const discardDocuments = async () => {
      await Promise.all(prepared.documents.map((document) => deleteStoredDocument(document.url)));
    };

    const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
      disciplineIds: input.disciplineIds,
      espaceValidated: false,
      membershipStatus: "pending",
      registrationState: "pending",
    });

    let clerkUserId: string;
    try {
      const user = await client.users.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        emailAddress: [email],
        password: input.password,
        privateMetadata,
        publicMetadata,
      });
      clerkUserId = user.id;
    } catch (error) {
      await discardDocuments();
      const mapped = mapClerkCreateError(error);
      if (mapped.kind === "error" && mapped.failure.code === "existing_account") {
        // Une demande simultanée a pu créer le dossier entre-temps.
        const latest = await readClubData();
        if (findActiveApplicationByEmail(latest.applications, email)) return { kind: "already_received" };
      }
      return mapped;
    }

    const rollback = async () => {
      try {
        const deletion = await tryDeleteClerkUser(clerkUserId);
        if (!deletion.ok) {
          console.error("Compte Clerk orphelin à supprimer manuellement", { clerkUserId });
        }
      } catch {
        console.error("Compte Clerk orphelin à supprimer manuellement", { clerkUserId });
      }
      await discardDocuments();
    };

    try {
      const outcome = await runClubTransaction<RegistrationOutcome>((data) => {
        if (findActiveApplicationByEmail(data.applications, email)) {
          abortWrite({ kind: "already_received" } satisfies RegistrationOutcome);
        }
        const verification = findVerifiedEmailCode(data, email, input.verificationId);
        if (!verification) {
          abortWrite(failure(VERIFICATION_USED_MESSAGE, 400, "email_not_verified"));
        }
        if (input.trialSlotId) {
          const slotCheck = validateTrialSlotForRegistration(data, {
            disciplineId: input.disciplineId,
            trialSlotId: input.trialSlotId,
          });
          if (!slotCheck.ok) {
            abortWrite(failure(slotCheck.message, slotCheck.status, "slot_unavailable"));
          }
        }

        const verifiedAt = consumeVerifiedEmailCode(verification);
        const application = buildRegistrationApplication({
          id: applicationId,
          disciplineId: input.disciplineId,
          disciplineIds: input.disciplineIds,
          trialSlotId: input.trialSlotId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          address: input.address,
          postalCode: input.postalCode,
          city: input.city,
          email,
          motivation: input.motivation,
          documents: prepared.documents,
          clerkUserId,
          membershipBulletin: prepared.membershipBulletin,
          emailVerifiedAt: verifiedAt,
        });
        data.applications.unshift(application);
        if (!data.members.some((member) => member.clerkUserId === clerkUserId)) {
          data.members.push(
            buildClubMemberRecord({
              clerkUserId,
              fullName: application.fullName,
              email,
            }),
          );
        }
        return {
          kind: "created",
          application,
          trialSlots: data.trialSlots.map((slot) => ({ ...slot })),
        } satisfies RegistrationOutcome;
      });

      if (outcome.kind !== "created") {
        await rollback();
        return outcome;
      }
      return { ...outcome, artifacts: prepared.artifacts };
    } catch (error) {
      await rollback();
      throw error;
    }
  });
}

export { SERVER_ERROR_MESSAGE as REGISTRATION_SERVER_ERROR_MESSAGE };
