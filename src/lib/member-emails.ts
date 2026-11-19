import type { BroadcastRecipient } from "@/lib/broadcast-types";
import type { ClubData, RegistrationApplication } from "@/lib/club-data";
import { getApplicationDisciplineIds } from "@/lib/dossier-workflow";

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

function applicationName(app: RegistrationApplication): string {
  return (
    app.fullName?.trim() ||
    [app.firstName, app.lastName].filter(Boolean).join(" ").trim() ||
    ""
  );
}

/**
 * Un dossier compte pour une activité dès qu'elle figure dans la discipline principale,
 * les activités multiples du dossier ou le bulletin d'adhésion signé.
 */
function applicationMatchesDiscipline(
  app: RegistrationApplication,
  disciplineId: string,
): boolean {
  return getApplicationDisciplineIds(app).includes(disciplineId);
}

/**
 * Destinataires uniques (adresse + nom) des adhérents approuvés : tous, filtrés par
 * discipline ou une seule personne. Source de vérité de l'écran « Communication ».
 */
export function collectApprovedMemberRecipients(
  clubData: ClubData,
  audience: MemberEmailAudience = {},
): BroadcastRecipient[] {
  const disciplineId = audience.disciplineId?.trim() || null;
  const recipientEmail = audience.recipientEmail?.trim()
    ? normalizeEmail(audience.recipientEmail)
    : null;

  const namesByEmail = new Map<string, string>();
  const add = (email: string, name: string) => {
    const key = normalizeEmail(email);
    if (!namesByEmail.get(key)) {
      namesByEmail.set(key, name);
    }
  };

  const applications = clubData.applications
    .filter(isApprovedApplication)
    .filter(
      (app) =>
        Boolean(recipientEmail) ||
        !disciplineId ||
        applicationMatchesDiscipline(app, disciplineId),
    );
  for (const app of applications) {
    add(app.email, applicationName(app));
  }

  // Les membres saisis à la main n'ont pas d'activité : ils ne comptent que pour « tous »
  // ou pour un envoi à une seule personne.
  if (recipientEmail || !disciplineId) {
    for (const member of clubData.members) {
      if (member.membershipStatus === "approved" && member.email?.trim()) {
        add(member.email, member.fullName?.trim() ?? "");
      }
    }
  }

  const recipients: BroadcastRecipient[] = [...namesByEmail.entries()]
    .filter(([email]) => !recipientEmail || email === recipientEmail)
    .map(([email, name]) => ({ email, name: name || email }));

  return recipients.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Adresses uniques des dossiers approuvés (tous, filtrés par discipline ou une personne). */
export function collectApprovedMemberEmails(
  clubData: ClubData,
  audience: MemberEmailAudience = {},
): string[] {
  return collectApprovedMemberRecipients(clubData, audience)
    .map((recipient) => recipient.email)
    .sort();
}

export function countApprovedMemberEmails(
  clubData: ClubData,
  audience: MemberEmailAudience = {},
): number {
  return collectApprovedMemberRecipients(clubData, audience).length;
}
