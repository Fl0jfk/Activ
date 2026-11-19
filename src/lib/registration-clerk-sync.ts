import type { ApplicationDossierPhase, RegistrationApplication } from "@/lib/club-data";
import {
  buildMemberClerkMetadata,
  readClerkAccountRole,
  tryDeleteClerkUser,
  tryUpdateUserMetadata,
  type MembershipStatus,
  type RegistrationState,
} from "@/lib/clerk";
import { readRoleFromClerkUser } from "@/lib/clerk-role";
import { isClosedApplication, isFinalizedApplication } from "@/lib/dossier-transitions";
import { getApplicationDisciplineIds, getApplicationDossierPhase } from "@/lib/dossier-workflow";
import type { AppRole } from "@/lib/roles";
import { isBureauRole } from "@/lib/roles";
import { clerkClient } from "@clerk/nextjs/server";

export function isEspaceValidatedPhase(phase: ApplicationDossierPhase | undefined): boolean {
  return phase === "documents" || phase === "payment" || phase === "finalized";
}

/** Statut d'adhésion d'un seul dossier : « approved » uniquement s'il est payé, « rejected » s'il est clos. */
export function computeMembershipStatus(
  application: Pick<RegistrationApplication, "status" | "paymentStatus">,
): MembershipStatus {
  if (isFinalizedApplication(application)) return "approved";
  if (isClosedApplication(application)) return "rejected";
  return "pending";
}

export type ClerkAccessState = {
  espaceValidated: boolean;
  membershipStatus: MembershipStatus;
  registrationState: RegistrationState;
  hasPendingRegistrationRequest: boolean;
  disciplineIds: string[];
};

function uniqueDisciplines(applications: readonly RegistrationApplication[]): string[] {
  return Array.from(new Set(applications.flatMap((application) => getApplicationDisciplineIds(application))));
}

/**
 * Accès au compte de connexion d'après TOUS les dossiers d'une même personne.
 *
 * Le STATUT prime sur l'étape : un dossier refusé ou désinscrit ne donne plus aucun accès. Une
 * personne déjà inscrite (finalisée) qui dépose une nouvelle demande garde son accès et son
 * adhésion « approuvée » ; l'accès à l'espace est ouvert dès qu'un dossier non clos a dépassé
 * l'étape « Valider l'espace adhérent ».
 */
export function computeClerkAccessState(applications: readonly RegistrationApplication[]): ClerkAccessState {
  const open = applications.filter((application) => !isClosedApplication(application));
  if (open.length === 0) {
    const latest = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      espaceValidated: false,
      membershipStatus: "rejected",
      registrationState: "rejected",
      hasPendingRegistrationRequest: false,
      disciplineIds: latest ? getApplicationDisciplineIds(latest) : [],
    };
  }
  const finalized = open.filter(isFinalizedApplication);
  const espaceValidated = open.some((application) =>
    isEspaceValidatedPhase(getApplicationDossierPhase(application)),
  );
  return {
    espaceValidated,
    membershipStatus: finalized.length > 0 ? "approved" : "pending",
    registrationState:
      finalized.length > 0 ? "registered" : espaceValidated ? "espace_active" : "pending",
    hasPendingRegistrationRequest: open.some((application) => !isFinalizedApplication(application)),
    disciplineIds: uniqueDisciplines(finalized.length > 0 ? finalized : open),
  };
}

/** Ne pas écraser un rôle bureau/coach déjà présent côté Clerk. */
async function resolveEffectiveSyncRole(
  clerkUserId: string,
  preferredRole: AppRole,
): Promise<AppRole> {
  if (isBureauRole(preferredRole)) {
    return preferredRole;
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const existing = readRoleFromClerkUser(user).role;
    if (isBureauRole(existing)) {
      return existing;
    }
  } catch (error) {
    console.error("resolveEffectiveSyncRole: unable to read Clerk role", { clerkUserId, error });
  }
  return preferredRole;
}

export type ClerkSyncResult = { ok: true } | { ok: false; warning: string };

export const CLERK_SYNC_WARNING =
  "Le dossier est enregistré, mais le compte de connexion de l’adhérent n’a pas pu être mis à jour (accès à l’espace). Vérifiez-le ou prévenez l’administrateur du site.";

/**
 * Aligne le compte de connexion sur les dossiers de la personne. À appeler APRÈS chaque
 * modification enregistrée ; ne lève jamais d'erreur : en cas d'échec le dossier reste modifié et
 * l'appelant renvoie l'avertissement au bureau.
 *
 * `applications` : toutes les données (ou au moins les dossiers de la personne) APRÈS modification.
 * `role` : rôle à écrire ; sans `explicitRole`, un rôle bureau/coach déjà présent est conservé.
 */
export async function syncClerkForApplication(
  application: RegistrationApplication,
  options: {
    applications?: readonly RegistrationApplication[];
    role?: AppRole;
    explicitRole?: boolean;
  } = {},
): Promise<ClerkSyncResult> {
  const clerkUserId = application.clerkUserId;
  if (!clerkUserId) {
    return { ok: true };
  }
  try {
    const mine = (options.applications ?? []).filter(
      (entry) => entry.clerkUserId === clerkUserId && entry.id !== application.id,
    );
    const state = computeClerkAccessState([...mine, application]);

    const role = options.explicitRole
      ? (options.role ?? "member")
      : await resolveEffectiveSyncRole(clerkUserId, options.role ?? "member");
    const bureauBypass = isBureauRole(role);

    const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
      disciplineIds: state.disciplineIds,
      role,
      espaceValidated: bureauBypass ? true : state.espaceValidated,
      membershipStatus: bureauBypass ? "approved" : state.membershipStatus,
      registrationState: bureauBypass ? "registered" : state.registrationState,
    });
    const result = await tryUpdateUserMetadata(clerkUserId, privateMetadata, {
      ...publicMetadata,
      hasPendingRegistrationRequest: bureauBypass ? false : state.hasPendingRegistrationRequest,
    });
    if (!result.ok) {
      console.error("syncClerkForApplication: Clerk update failed", {
        applicationId: application.id,
        clerkUserId,
        error: result.message,
      });
      return { ok: false, warning: CLERK_SYNC_WARNING };
    }
    return { ok: true };
  } catch (error) {
    console.error("syncClerkForApplication: unexpected error", {
      applicationId: application.id,
      clerkUserId,
      error,
    });
    return { ok: false, warning: CLERK_SYNC_WARNING };
  }
}

export type ClerkAccountRemoval = {
  deleted: boolean;
  /** Raison pour laquelle le compte a été volontairement conservé. */
  kept?: "self" | "staff" | "other_dossier";
  /** Message affichable au bureau si la suppression a échoué ou a été évitée par prudence. */
  warning?: string;
};

/**
 * Suppression du compte de connexion lors d'un REFUS (jamais pour une désinscription, qui se
 * contente de fermer l'accès : la personne peut se reconnecter et redéposer une pré-inscription).
 * Le compte est conservé s'il s'agit de l'utilisateur lui-même, d'un compte bureau/coach, ou si la
 * personne a un autre dossier actif.
 */
export async function removeClerkAccountForRejection(params: {
  clerkUserId: string;
  actorUserId: string;
  hasOtherActiveDossier: boolean;
}): Promise<ClerkAccountRemoval> {
  if (params.clerkUserId === params.actorUserId) {
    return {
      deleted: false,
      kept: "self",
      warning:
        "Le compte de connexion n’a pas été supprimé (c’est votre propre compte). Le dossier est tout de même refusé.",
    };
  }
  if (params.hasOtherActiveDossier) {
    return { deleted: false, kept: "other_dossier" };
  }
  const account = await readClerkAccountRole(params.clerkUserId);
  if (!account.ok) {
    return {
      deleted: false,
      warning:
        "Le dossier est refusé, mais le compte de connexion n’a pas pu être vérifié ni supprimé. Prévenez l’administrateur du site.",
    };
  }
  if (!account.exists) {
    return { deleted: true };
  }
  if (isBureauRole(account.role)) {
    return {
      deleted: false,
      kept: "staff",
      warning:
        "Le compte de connexion n’a pas été supprimé : il s’agit d’un compte du bureau ou d’un coach. Le dossier est tout de même refusé.",
    };
  }
  const deletion = await tryDeleteClerkUser(params.clerkUserId);
  if (!deletion.ok) {
    console.error("Clerk delete failed on reject", {
      clerkUserId: params.clerkUserId,
      error: deletion.message,
    });
    return {
      deleted: false,
      warning:
        "Le dossier est refusé, mais le compte de connexion n’a pas pu être supprimé : la personne ne pourra pas se réinscrire avec cette adresse e-mail tant qu’il existe. Réessayez depuis le dossier (« Supprimer le compte de connexion ») ou prévenez l’administrateur du site.",
    };
  }
  return { deleted: true };
}
