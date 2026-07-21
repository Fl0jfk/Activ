import type { ClubData, RegistrationApplication } from "@/lib/club-data";

export type MemberEmailAudience = {
  /** `null` ou omis = tous les adhérents approuvés */
  disciplineId?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isApprovedApplication(app: RegistrationApplication): boolean {
  return app.status === "approved" && Boolean(app.email?.trim());
}

/** Adresses uniques des dossiers approuvés (tous ou filtrés par discipline). */
export function collectApprovedMemberEmails(
  clubData: ClubData,
  audience: MemberEmailAudience = {},
): string[] {
  const disciplineId = audience.disciplineId?.trim() || null;

  const fromApplications = clubData.applications
    .filter(isApprovedApplication)
    .filter((app) => !disciplineId || app.disciplineId === disciplineId)
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
