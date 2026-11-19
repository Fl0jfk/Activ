import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { ClubData, EmailVerificationCode } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import { isValidEmailAddress } from "@/lib/input-validation";

/** Durée de validité du code envoyé par e-mail. */
export const EMAIL_CODE_TTL_MINUTES = 15;
/** Durée pendant laquelle une adresse vérifiée peut finaliser son inscription. */
export const EMAIL_VERIFIED_TTL_MINUTES = 120;
/** Nombre d'essais autorisés sur un même code. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Délai minimum entre deux envois à la même adresse. */
export const EMAIL_CODE_RESEND_SECONDS = 60;
/** Nombre maximum de codes envoyés à une adresse sur une heure. */
export const EMAIL_CODE_MAX_PER_HOUR = 5;

const HOUR_MS = 60 * 60 * 1000;

export function normalizeVerificationEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isValidEmail(email: unknown): boolean {
  return isValidEmailAddress(normalizeVerificationEmail(email));
}

/**
 * Secret de hachage des codes. Ordre : EMAIL_VERIFICATION_SECRET, sinon une clé dérivée de CLERK_SECRET_KEY
 * (toujours présente en production, donc l'inscription ne tombe jamais en panne pour un oubli de variable),
 * sinon une valeur de repli réservée au développement.
 */
function verificationSecret(): string {
  const secret = process.env.EMAIL_VERIFICATION_SECRET?.trim();
  if (secret) return secret;
  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim();
  if (clerkSecret) {
    return createHmac("sha256", clerkSecret).update("activ:email-verification").digest("hex");
  }
  if (process.env.NODE_ENV === "production") {
    console.error("Aucun secret disponible pour la vérification des e-mails (EMAIL_VERIFICATION_SECRET ou CLERK_SECRET_KEY).");
    throw new Error("A secret is required to verify e-mail addresses in production.");
  }
  return "activ-dev-only-email-verification-secret";
}

/** Vrai quand la configuration permet de vérifier des adresses (pour répondre proprement avant tout envoi). */
export function isEmailVerificationConfigured(): boolean {
  return (
    Boolean(process.env.EMAIL_VERIFICATION_SECRET?.trim()) ||
    Boolean(process.env.CLERK_SECRET_KEY?.trim()) ||
    process.env.NODE_ENV !== "production"
  );
}

/** Empreinte liée à l'adresse, à l'identifiant de la vérification et au code. */
export function hashEmailCode(email: string, verificationId: string, code: string): string {
  return createHmac("sha256", verificationSecret())
    .update(`${normalizeVerificationEmail(email)}:${verificationId}:${code.trim()}`)
    .digest("hex");
}

function hashesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function timeOf(value: string): number {
  return new Date(value).getTime();
}

function isExpired(value: string): boolean {
  const time = timeOf(value);
  return !Number.isFinite(time) || time <= Date.now();
}

/** Supprime les codes trop anciens pour ne pas faire grossir le fichier. */
export function pruneEmailVerificationCodes(data: ClubData): void {
  const limit = Date.now() - 24 * HOUR_MS;
  data.emailVerificationCodes = (data.emailVerificationCodes ?? []).filter((entry) => {
    const created = timeOf(entry.createdAt);
    return Number.isFinite(created) && created > limit;
  });
}

export type IssueEmailCodeResult =
  | { ok: true; code: string; record: EmailVerificationCode }
  | { ok: false; message: string; retryAfterSeconds: number };

/**
 * Crée et enregistre un code à 6 chiffres pour une adresse.
 * À appeler dans `updateClubData` : les plafonds se vérifient sur des données fraîches, sous verrou.
 */
export function issueEmailVerificationCode(data: ClubData, email: string): IssueEmailCodeResult {
  const normalized = normalizeVerificationEmail(email);
  pruneEmailVerificationCodes(data);
  const records = data.emailVerificationCodes ?? [];

  const now = Date.now();
  const recent = records.filter((entry) => entry.email === normalized);
  const lastCreated = recent
    .map((entry) => timeOf(entry.createdAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];

  if (lastCreated && now - lastCreated < EMAIL_CODE_RESEND_SECONDS * 1000) {
    const wait = Math.ceil((lastCreated + EMAIL_CODE_RESEND_SECONDS * 1000 - now) / 1000);
    return {
      ok: false,
      message: `Un code vient d'être envoyé. Patientez ${wait} seconde${wait > 1 ? "s" : ""} avant d'en redemander un.`,
      retryAfterSeconds: wait,
    };
  }

  const lastHour = recent
    .map((entry) => timeOf(entry.createdAt))
    .filter((time) => Number.isFinite(time) && now - time < HOUR_MS)
    .sort((a, b) => a - b);
  if (lastHour.length >= EMAIL_CODE_MAX_PER_HOUR) {
    return {
      ok: false,
      message:
        "Trop de codes ont été demandés pour cette adresse. Réessayez dans un moment ou contactez le bureau.",
      retryAfterSeconds: Math.max(1, Math.ceil((lastHour[0]! + HOUR_MS - now) / 1000)),
    };
  }

  const id = randomId("email-verif");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record: EmailVerificationCode = {
    id,
    email: normalized,
    codeHash: hashEmailCode(normalized, id, code),
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: minutesFromNow(EMAIL_CODE_TTL_MINUTES),
    verifiedAt: null,
    consumedAt: null,
  };

  // Un seul code actif par adresse : les anciens codes non validés ne sont plus utilisables.
  data.emailVerificationCodes = [
    record,
    ...records.filter((entry) => entry.email !== normalized || entry.verifiedAt !== null),
  ];

  return { ok: true, code, record };
}

/** Retire un code créé mais jamais remis (envoi de l'e-mail impossible). */
export function discardEmailVerificationRecord(data: ClubData, recordId: string): void {
  data.emailVerificationCodes = (data.emailVerificationCodes ?? []).filter(
    (entry) => entry.id !== recordId,
  );
}

export type CheckEmailCodeResult =
  | { ok: true; record: EmailVerificationCode }
  | {
      ok: false;
      message: string;
      /** Vrai si le compteur d'essais a changé : les données doivent être enregistrées. */
      mutated: boolean;
    };

/**
 * Contrôle le code saisi et marque la vérification comme réussie.
 * À appeler dans `updateClubData` : le compteur d'essais est ainsi fiable, même avec des requêtes simultanées.
 */
export function checkEmailCode(data: ClubData, email: string, code: string): CheckEmailCodeResult {
  const normalized = normalizeVerificationEmail(email);
  const entry = (data.emailVerificationCodes ?? [])
    .filter((candidate) => candidate.email === normalized && !candidate.consumedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!entry) {
    return {
      ok: false,
      mutated: false,
      message: "Aucun code en attente pour cette adresse. Demandez un nouveau code.",
    };
  }
  if (isExpired(entry.expiresAt)) {
    return { ok: false, mutated: false, message: "Ce code a expiré. Demandez un nouveau code." };
  }
  if (entry.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return {
      ok: false,
      mutated: false,
      message: "Trop d'essais incorrects. Demandez un nouveau code.",
    };
  }

  const matches = hashesMatch(entry.codeHash, hashEmailCode(normalized, entry.id, code));

  // Code déjà validé : la même saisie renvoie la même vérification, sans prolonger sa durée.
  if (matches && entry.verifiedAt) {
    return { ok: true, record: entry };
  }

  entry.attempts += 1;
  if (!matches) {
    return {
      ok: false,
      mutated: true,
      message:
        entry.attempts >= EMAIL_CODE_MAX_ATTEMPTS
          ? "Code incorrect. Demandez un nouveau code."
          : "Code incorrect. Vérifiez les 6 chiffres reçus par e-mail.",
    };
  }

  entry.verifiedAt = new Date().toISOString();
  return { ok: true, record: entry };
}

function verifiedWithinTtl(entry: EmailVerificationCode): boolean {
  if (!entry.verifiedAt) return false;
  const verifiedTime = timeOf(entry.verifiedAt);
  return Number.isFinite(verifiedTime) && Date.now() - verifiedTime <= EMAIL_VERIFIED_TTL_MINUTES * 60 * 1000;
}

/**
 * Preuve que l'adresse a été confirmée récemment, même si la vérification a déjà servi
 * (permet de reconnaître un renvoi du même formulaire).
 */
export function findEmailVerificationProof(
  data: ClubData,
  email: string,
  verificationId: unknown,
): EmailVerificationCode | null {
  if (typeof verificationId !== "string" || !verificationId) return null;
  const normalized = normalizeVerificationEmail(email);
  const entry = (data.emailVerificationCodes ?? []).find(
    (candidate) => candidate.id === verificationId && candidate.email === normalized,
  );
  return entry && verifiedWithinTtl(entry) ? entry : null;
}

/** Vérification encore utilisable : adresse confirmée récemment et pas encore consommée. */
export function findVerifiedEmailCode(
  data: ClubData,
  email: string,
  verificationId: unknown,
): EmailVerificationCode | null {
  const entry = findEmailVerificationProof(data, email, verificationId);
  return entry && entry.consumedAt === null ? entry : null;
}

/** Marque la vérification comme utilisée (une seule inscription par confirmation). Renvoie la date de confirmation. */
export function consumeVerifiedEmailCode(entry: EmailVerificationCode): string {
  const verifiedAt = entry.verifiedAt ?? new Date().toISOString();
  entry.consumedAt = new Date().toISOString();
  return verifiedAt;
}
