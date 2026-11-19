import type { RegistrationApplication } from "@/lib/club-data";
import { isDossierFinalise } from "@/lib/dossier-workflow";
import { addDaysToIsoDate, isValidIsoDate, todayParisIso } from "@/lib/schedule-week";

const RENEWAL_ALERT_DAYS = 30;

/**
 * Toutes les dates de licence sont des jours calendaires « AAAA-MM-JJ » à l'heure de Paris :
 * on compare des chaînes ISO plutôt que des instants, pour ne dépendre ni du fuseau du serveur
 * ni de celui du navigateur. Une licence reste valable jusqu'à la fin de sa date de fin (incluse).
 */

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Ajoute des années à une date ISO ; le 29 février devient le 28 février d'une année non bissextile. */
export function addYearsToIsoDate(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const targetYear = year + years;
  const clampedDay = month === 2 && day === 29 && !isLeapYear(targetYear) ? 28 : day;
  return `${String(targetYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/** Date ISO (YYYY-MM-DD) = jour de Paris de `from` + 1 an. */
export function addOneYearLicenseDate(from: Date = new Date()): string {
  return addYearsToIsoDate(todayParisIso(from), 1);
}

/**
 * Nouvelle fin de licence : un an après la fin actuelle si elle est encore à venir
 * (le renouvellement ne fait pas perdre de jours), sinon un an après aujourd'hui.
 */
export function nextLicenseEndDate(
  currentEnd: string | null | undefined,
  today: string = todayParisIso(),
): string {
  const base = currentEnd && isValidIsoDate(currentEnd) && currentEnd > today ? currentEnd : today;
  return addYearsToIsoDate(base, 1);
}

/** Licence déjà expirée ou qui expire dans ≤ `withinDays` jours. */
export function isLicenseNeedingRenewalAlert(
  licenseEndDate: string | null | undefined,
  withinDays = RENEWAL_ALERT_DAYS,
  now: Date = new Date(),
): boolean {
  if (!licenseEndDate || !isValidIsoDate(licenseEndDate)) return false;
  return licenseEndDate <= addDaysToIsoDate(todayParisIso(now), withinDays);
}

export function isLicenseExpired(licenseEndDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!licenseEndDate || !isValidIsoDate(licenseEndDate)) return false;
  return licenseEndDate < todayParisIso(now);
}

/** Jours restants avant la fin de la licence (0 si terminée ou si la date est inconnue). */
export function daysUntilLicenseEnd(licenseEndDate: string, now: Date = new Date()): number {
  if (!isValidIsoDate(licenseEndDate)) return 0;
  const [ey, em, ed] = licenseEndDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = todayParisIso(now).split("-").map(Number) as [number, number, number];
  const diff = (Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000;
  return Math.max(0, Math.round(diff));
}

export function formatLicenseEndDateFr(licenseEndDate: string): string {
  if (!isValidIsoDate(licenseEndDate)) return licenseEndDate;
  const date = new Date(`${licenseEndDate}T12:00:00Z`);
  return date.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Dossiers finalisés à alerter pour renouvellement (hors désinscrits). */
export function listApplicationsNeedingLicenseRenewal(
  applications: RegistrationApplication[],
): RegistrationApplication[] {
  return applications
    .filter((app) => app.status !== "cancelled" && app.status !== "rejected")
    .filter(isDossierFinalise)
    .filter((app) => isLicenseNeedingRenewalAlert(app.licenseEndDate))
    .sort((a, b) => (a.licenseEndDate ?? "").localeCompare(b.licenseEndDate ?? ""));
}
