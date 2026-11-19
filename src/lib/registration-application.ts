import type { ClubMember, RegistrationApplication } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import type { CurrentUserContext } from "@/lib/clerk";
import type { MembershipBulletinData } from "@/lib/membership-bulletin";

export type RegistrationApplicantInput = {
  /** Identifiant imposé (permet d'envoyer les fichiers avant de créer le dossier). */
  id?: string;
  disciplineId: string;
  disciplineIds?: string[];
  trialSlotId?: string | null;
  origin?: "online" | "paper";
  signedBulletinReceivedAt?: string | null;
  amountPaid?: number | null;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  motivation?: string;
  documents?: { name: string; url: string; uploadedAt: string }[];
  clerkUserId: string | null;
  membershipBulletin?: MembershipBulletinData | null;
  /** Adresse e-mail confirmée par code lors de l'inscription. */
  emailVerifiedAt?: string | null;
};

export function buildRegistrationApplication(
  input: RegistrationApplicantInput,
): RegistrationApplication {
  const withTrial = Boolean(input.trialSlotId);
  const createdAt = new Date().toISOString();
  const email = input.email.trim().toLowerCase();

  return {
    id: input.id ?? randomId("app"),
    clerkUserId: input.clerkUserId,
    fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    postalCode: input.postalCode.trim(),
    city: input.city.trim(),
    documents: Array.isArray(input.documents) ? input.documents : [],
    requestKind: "trial_and_preregistration",
    disciplineId: input.disciplineId,
    disciplineIds:
      input.disciplineIds && input.disciplineIds.length > 0
        ? input.disciplineIds
        : [input.disciplineId],
    origin: input.origin ?? "online",
    signedBulletinReceivedAt: input.signedBulletinReceivedAt ?? null,
    amountPaid: input.amountPaid ?? null,
    trialSlotId: withTrial ? (input.trialSlotId ?? null) : null,
    motivation: input.motivation?.trim() ?? "",
    createdAt,
    status: "pending",
    dossierPhase: "reception",
    trialAttended: false,
    paymentStatus: "unpaid",
    paymentMethod: "",
    licenseEndDate: null,
    notes: "",
    membershipBulletin: input.membershipBulletin ?? null,
    emailVerifiedAt: input.emailVerifiedAt ?? null,
  };
}

/** Un dossier refusé ou arrêté ne bloque pas une nouvelle inscription. */
export function isActiveApplicationStatus(status: RegistrationApplication["status"]): boolean {
  return status !== "rejected" && status !== "cancelled";
}

export function findActiveApplicationByEmail(
  applications: RegistrationApplication[],
  email: string,
): RegistrationApplication | null {
  const normalized = email.trim().toLowerCase();
  return (
    applications.find(
      (entry) =>
        isActiveApplicationStatus(entry.status) &&
        typeof entry.email === "string" &&
        entry.email.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export function buildClubMemberRecord(params: {
  clerkUserId: string;
  fullName: string;
  email: string;
  role?: ClubMember["role"];
  membershipStatus?: ClubMember["membershipStatus"];
}): ClubMember {
  return {
    clerkUserId: params.clerkUserId,
    fullName: params.fullName,
    email: params.email.trim().toLowerCase(),
    role: params.role ?? "member",
    functions: [],
    membershipStatus: params.membershipStatus ?? "pending",
    updatedAt: new Date().toISOString(),
  };
}

export function upsertMemberForApplication(
  members: ClubMember[],
  user: CurrentUserContext,
  email: string,
): void {
  const createdAt = new Date().toISOString();
  const existingMember = members.find((entry) => entry.clerkUserId === user.userId);
  if (existingMember) {
    existingMember.fullName = user.fullName;
    existingMember.email = email.trim();
    existingMember.updatedAt = createdAt;
  } else {
    members.push(
      buildClubMemberRecord({
        clerkUserId: user.userId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }),
    );
  }
}
