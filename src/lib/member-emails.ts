import type { ClubData, RegistrationApplication } from "@/lib/club-data";

export type MemberEmailAudience = {
  /** `null` ou omis = tous les adhérents approuvés */
  disciplineId?: string | null;
  /** Une seule adresse e-mail (adhérent approuvé). Prioritaire sur la discipline. */
  recipientEmail?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isApprovedApplication(app: RegistrationApplication): boolean {
  return app.status === "approved" && Boolean(app.email?.trim());
}

function applicationMatchesDiscipline(
  app: RegistrationApplication,
  disciplineId: string,
): boolean {
  if (app.disciplineId === disciplineId) return true;
  return Boolean(app.disciplineIds?.includes(disciplineId));
}

/** Adresses uniques des dossiers approuvés (tous, filtrés par discipline ou une personne). */
export function collectApprovedMemberEmails(
  clubData: ClubData,
  audience: MemberEmailAudience = {},
): string[] {
  const disciplineId = audience.disciplineId?.trim() || null;
  const recipientEmail = audience.recipientEmail?.trim()
    ? normalizeEmail(audience.recipientEmail)
    : null;

  if (recipientEmail) {
    const known = new Set<string>();
    for (const application of clubData.applications.filter(isApprovedApplication)) {
      known.add(normalizeEmail(application.email));
    }
    for (const member of clubData.members) {
      if (member.membershipStatus === "approved" && member.email?.trim()) {
        known.add(normalizeEmail(member.email));
      }
    }
    return known.has(recipientEmail) ? [recipientEmail] : [];
  }

  const fromApplications = clubData.applications
    .filter(isApprovedApplication)
    .filter((app) => !disciplineId || applicationMatchesDiscipline(app, disciplineId))
    .map((app) => normalizeEmail(app.email));

  const emails = new Set(fromApplications);

  if (!disciplineId) {
    for (const member of clubData.members) {
      if (member.membershipStatus === "approved" && member.email?.trim()) {
        emails.add(normalizeEmail(member.email));
      }
    }
  }

  return [...emails].sort();
}

export function countApprovedMemberEmails(
  clubData: ClubData,
  audience: MemberEmailAudience = {},
): number {
  return collectApprovedMemberEmails(clubData, audience).length;
}
