import type { ClubMember, RegistrationApplication } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import type { CurrentUserContext } from "@/lib/clerk";
import type { MembershipBulletinData } from "@/lib/membership-bulletin";

export type RegistrationApplicantInput = {
  disciplineId: string;
  trialSlotId?: string | null;
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
};

export function buildRegistrationApplication(
  input: RegistrationApplicantInput,
): RegistrationApplication {
  const withTrial = Boolean(input.trialSlotId);
  const createdAt = new Date().toISOString();
  const email = input.email.trim().toLowerCase();

  return {
    id: randomId("app"),
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
  };
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
