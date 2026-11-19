/** Contrôles de format côté navigateur (le serveur revalide toujours). */

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
}

/** Numéro français ou étranger : chiffres, espaces, points, tirets, « + » et parenthèses acceptés. */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[+()\d\s.-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function isValidPostalCode(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

/** Date du jour dans le fuseau du navigateur (AAAA-MM-JJ). À appeler uniquement hors rendu. */
export function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDateFr(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export const MESSAGES = {
  firstName: "Indiquez votre prénom.",
  lastName: "Indiquez votre nom.",
  phone: "Indiquez un numéro de téléphone valide, par exemple 06 12 34 56 78.",
  phoneMissing: "Indiquez votre numéro de téléphone.",
  email: "Indiquez une adresse e-mail valide, par exemple nom@exemple.fr.",
  emailMissing: "Indiquez votre adresse e-mail.",
  address: "Indiquez votre adresse (numéro et rue).",
  postalCode: "Le code postal doit contenir 5 chiffres.",
  city: "Indiquez votre commune.",
} as const;
