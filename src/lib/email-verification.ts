import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { ClubData, EmailVerificationCode } from "@/lib/club-data";
import { randomId } from "@/lib/ids";

/** Durée de validité du code envoyé par e-mail. */
export const EMAIL_CODE_TTL_MINUTES = 15;
/** Durée pendant laquelle une adresse vérifiée peut finaliser son inscription. */
export const EMAIL_VERIFIED_TTL_MINUTES = 45;
/** Nombre d'essais autorisés sur un même code. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Délai minimum entre deux envois à la même adresse. */
export const EMAIL_CODE_RESEND_SECONDS = 60;
/** Nombre maximum de codes envoyés à une adresse sur une heure. */
export const EMAIL_CODE_MAX_PER_HOUR = 5;
/** Plafond global pour éviter l'envoi massif de codes (spam d'adresses). */
export const EMAIL_CODE_GLOBAL_MAX_PER_HOUR = 100;

export function normalizeVerificationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeVerificationEmail(email));
}

function pepper(): string {
  return process.env.EMAIL_VERIFICATION_SECRET?.trim() || "activ-email-verification";
}

export function hashEmailCode(email: string, code: string): string {
  return createHash("sha256")
    .update(`${normalizeVerificationEmail(email)}:${code.trim()}:${pepper()}`)
    .digest("hex");
}

function codesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function isExpired(value: string): boolean {
  const time = new Date(value).getTime();
  return !Number.isFinite(time) || time <= Date.now();
}

/** Supprime les codes trop anciens pour ne pas faire grossir le fichier. */
export function pruneEmailVerificationCodes(data: ClubData): void {
  const limit = Date.now() - 24 * 60 * 60 * 1000;
  data.emailVerificationCodes = (data.emailVerificationCodes ?? []).filter((entry) => {
    const created = new Date(entry.createdAt).getTime();
    return Number.isFinite(created) && created > limit;
  });
}

export type CreateEmailCodeResult =
  | { ok: true; code: string; record: EmailVerificationCode }
  | { ok: false; message: string };

/** Crée et enregistre un code à 6 chiffres pour une adresse. */
export function createEmailVerificationCode(
  data: ClubData,
  email: string,
): CreateEmailCodeResult {
  const normalized = normalizeVerificationEmail(email);
  pruneEmailVerificationCodes(data);

  const now = Date.now();
  const recent = (data.emailVerificationCodes ?? []).filter(
    (entry) => entry.email === normalized,
  );
  const last = recent
    .map((entry) => new Date(entry.createdAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];

  if (last && now - last < EMAIL_CODE_RESEND_SECONDS * 1000) {
    return {
      ok: false,
      message: `Un code vient d'être envoyé. Patientez ${EMAIL_CODE_RESEND_SECONDS} secondes avant de redemander.`,
    };
  }

  const lastHour = (data.emailVerificationCodes ?? []).filter(
    (entry) => now - new Date(entry.createdAt).getTime() < 60 * 60 * 1000,
  );
  if (lastHour.length >= EMAIL_CODE_GLOBAL_MAX_PER_HOUR) {
    return {
      ok: false,
      message:
        "Trop de demandes de vérification en cours. Réessayez dans un moment ou contactez le bureau.",
    };
  }

  if (recent.filter((entry) => now - new Date(entry.createdAt).getTime() < 60 * 60 * 1000).length >= EMAIL_CODE_MAX_PER_HOUR) {
    return {
      ok: false,
      message:
        "Trop de codes ont été demandés pour cette adresse. Réessayez dans une heure ou contactez le bureau.",
    };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record: EmailVerificationCode = {
    id: randomId("email-verif"),
    email: normalized,
    codeHash: hashEmailCode(normalized, code),
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: minutesFromNow(EMAIL_CODE_TTL_MINUTES),
    verifiedAt: null,
    consumedAt: null,
  };

  // Un seul code actif par adresse : les anciens deviennent inutilisables.
  data.emailVerificationCodes = [
    record,
    ...(data.emailVerificationCodes ?? []).filter(
      (entry) => entry.email !== normalized || entry.consumedAt === null,
    ),
  ];

  return { ok: true, code, record };
}

export type VerifyEmailCodeResult =
  | { ok: true; record: EmailVerificationCode }
  | { ok: false; message: string };

/** Contrôle le code saisi et marque la vérification comme réussie. */
export function verifyEmailCode(
  data: ClubData,
  email: string,
  code: string,
): VerifyEmailCodeResult {
  const normalized = normalizeVerificationEmail(email);
  const entry = (data.emailVerificationCodes ?? [])
    .filter((candidate) => candidate.email === normalized && !candidate.consumedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!entry) {
    return {
      ok: false,
      message: "Aucun code en attente pour cette adresse. Demandez un nouveau code.",
    };
  }
  if (isExpired(entry.expiresAt)) {
    return { ok: false, message: "Ce code a expiré. Demandez un nouveau code." };
  }
  if (entry.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return {
      ok: false,
      message: "Trop d'essais incorrects. Demandez un nouveau code.",
    };
  }

  entry.attempts += 1;
  if (!codesMatch(entry.codeHash, hashEmailCode(normalized, code.trim()))) {
    return {
      ok: false,
      message:
        entry.attempts >= EMAIL_CODE_MAX_ATTEMPTS
          ? "Code incorrect. Demandez un nouveau code."
          : "Code incorrect. Vérifiez les 6 chiffres reçus par e-mail.",
    };
  }

  entry.verifiedAt = new Date().toISOString();
  return { ok: true, record: entry };
}

/** Vérifie qu'une inscription s'appuie sur une adresse confirmée récemment. */
export function findVerifiedEmailCode(
  data: ClubData,
  email: string,
  verificationId: string | null | undefined,
): EmailVerificationCode | null {
  if (!verificationId) return null;
  const normalized = normalizeVerificationEmail(email);
  const entry = (data.emailVerificationCodes ?? []).find(
    (candidate) =>
      candidate.id === verificationId &&
      candidate.email === normalized &&
      candidate.verifiedAt !== null &&
      candidate.consumedAt === null,
  );
  if (!entry?.verifiedAt) return null;
  const verifiedTime = new Date(entry.verifiedAt).getTime();
  if (
    !Number.isFinite(verifiedTime) ||
    Date.now() - verifiedTime > EMAIL_VERIFIED_TTL_MINUTES * 60 * 1000
  ) {
    return null;
  }
  return entry;
}

export function consumeVerifiedEmailCode(entry: EmailVerificationCode): string {
  const verifiedAt = entry.verifiedAt ?? new Date().toISOString();
  entry.consumedAt = new Date().toISOString();
  return verifiedAt;
}
