import type { RegistrationApplication } from "@/lib/club-data";
import { isDossierFinalise } from "@/lib/dossier-workflow";

const RENEWAL_ALERT_DAYS = 30;

/** Date ISO (YYYY-MM-DD) = aujourd’hui + 1 an. */
export function addOneYearLicenseDate(from: Date = new Date()): string {
  const next = new Date(from);
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function parseLicenseEnd(licenseEndDate: string): Date {
  return new Date(`${licenseEndDate}T23:59:59`);
}

/** Licence déjà expirée ou qui expire dans ≤ `withinDays` jours. */
export function isLicenseNeedingRenewalAlert(
  licenseEndDate: string | null | undefined,
  withinDays = RENEWAL_ALERT_DAYS,
  now: Date = new Date(),
): boolean {
  if (!licenseEndDate) return false;
  const end = parseLicenseEnd(licenseEndDate);
  if (Number.isNaN(end.getTime())) return false;
  const limit = new Date(now);
  limit.setDate(limit.getDate() + withinDays);
  return end.getTime() <= limit.getTime();
}

export function isLicenseExpired(licenseEndDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!licenseEndDate) return false;
  const end = parseLicenseEnd(licenseEndDate);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < now.getTime();
}

export function formatLicenseEndDateFr(licenseEndDate: string): string {
  const date = new Date(`${licenseEndDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return licenseEndDate;
  return date.toLocaleDateString("fr-FR", {
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
