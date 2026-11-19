/** Contrôles de saisie communs (utilisables côté serveur comme côté navigateur). */

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/** Texte d'une seule ligne : accepte uniquement une chaîne, retire les caractères de contrôle et les espaces superflus. */
export function cleanLine(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Texte multiligne (retours à la ligne conservés), sans caractères de contrôle. */
export function cleanMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Vrai si la chaîne dépasse la longueur autorisée (avant tout nettoyage). */
export function isTooLong(value: unknown, maxLength: number): boolean {
  return typeof value === "string" && value.length > maxLength;
}

const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isValidEmailAddress(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length < 6 || email.length > 254) return false;
  const [local] = email.split("@");
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || email.includes("..")) {
    return false;
  }
  return EMAIL_PATTERN.test(email);
}

/**
 * Numéro de téléphone saisi avec espaces, points, tirets ou indicatif (+33, 0033).
 * Un numéro français (fixe ou mobile) est renvoyé au format « 06 86 14 06 79 » ;
 * un numéro étranger correctement formé (« +41 … », « 0041 … ») est renvoyé sous la forme « +41… ».
 * Renvoie null si le numéro n'est pas valide.
 */
export function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 30) return null;
  const compact = value.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;

  let national = compact;
  if (national.startsWith("+33")) national = `0${national.slice(3)}`;
  else if (national.startsWith("0033")) national = `0${national.slice(4)}`;
  // « +33 (0)6 … » : le 0 entre parenthèses a été retiré plus haut, il donne donc « 00… ».
  if (/^00[1-9]\d{8}$/.test(national)) national = national.slice(1);
  if (/^0[1-9]\d{8}$/.test(national)) return national.replace(/(\d{2})(?=\d)/g, "$1 ");

  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (/^\+[1-9]\d{7,14}$/.test(international) && !international.startsWith("+33")) return international;
  return null;
}

export function isValidFrenchPostalCode(value: unknown): boolean {
  return typeof value === "string" && /^(0[1-9]|[1-8]\d|9[0-8])\d{3}$/.test(value.trim());
}

/** Date de naissance « AAAA-MM-JJ » réelle, passée et plausible. */
export function validateBirthDate(
  value: unknown,
  now: Date = new Date(),
): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof value !== "string") return { ok: false, message: "Indiquez votre date de naissance." };
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return { ok: false, message: "Date de naissance invalide." };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, message: "Cette date de naissance n'existe pas." };
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() >= today) {
    return { ok: false, message: "La date de naissance doit être dans le passé." };
  }
  if (year < now.getUTCFullYear() - 110) {
    return { ok: false, message: "Date de naissance invraisemblable. Vérifiez l'année." };
  }
  return { ok: true, value: text };
}

export const PASSWORD_MIN_LENGTH = 8;
/** Clerk limite les mots de passe à 72 octets. */
export const PASSWORD_MAX_BYTES = 72;

/** Mot de passe : 8 caractères minimum, avec au moins une lettre et un chiffre. Clerk applique ensuite ses propres règles. */
export function validatePasswordRules(value: unknown): { ok: true } | { ok: false; message: string } {
  if (typeof value !== "string" || value.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) {
    return { ok: false, message: "Mot de passe trop long (72 caractères au maximum)." };
  }
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) {
    return { ok: false, message: "Le mot de passe doit contenir des lettres et des chiffres." };
  }
  return { ok: true };
}
