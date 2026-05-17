import { auth, clerkClient } from "@clerk/nextjs/server";
import { readRoleFromClerkUser } from "@/lib/clerk-role";
import type { AppRole } from "@/lib/roles";

export type { AppRole } from "@/lib/roles";
export type MembershipStatus = "pending" | "approved" | "rejected";
export type RegistrationState = "pending" | "espace_active" | "registered" | "rejected";

export type AppPrivateMetadata = {
  role?: AppRole;
  membershipStatus?: MembershipStatus;
  espaceValidated?: boolean;
  disciplineIds?: string[];
  coachDisciplineIds?: string[];
};

export type AppPublicMetadata = {
  role?: AppRole;
  membershipStatus?: MembershipStatus;
  espaceValidated?: boolean;
  disciplineIds?: string[];
  displayRole?: string;
  registrationState?: RegistrationState;
};

export type CurrentUserContext = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  membershipStatus: MembershipStatus;
  espaceValidated: boolean;
  disciplineIds: string[];
};

function normalizeMembershipStatus(value: unknown): MembershipStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }
  return "pending";
}

function normalizeEspaceValidated(value: unknown): boolean {
  return value === true;
}

function normalizeDisciplineIds(privateMeta: AppPrivateMetadata, publicMeta: AppPublicMetadata): string[] {
  if (Array.isArray(privateMeta.disciplineIds) && privateMeta.disciplineIds.length > 0) {
    return privateMeta.disciplineIds.filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(publicMeta.disciplineIds) && publicMeta.disciplineIds.length > 0) {
    return publicMeta.disciplineIds.filter((id): id is string => typeof id === "string");
  }
  const legacy = publicMeta as { preferredDisciplineId?: string };
  if (typeof legacy.preferredDisciplineId === "string" && legacy.preferredDisciplineId) {
    return [legacy.preferredDisciplineId];
  }
  return [];
}

/** Staff, coach et direction : jamais bloqués par une adhésion « en attente ». */
function resolveMembershipStatus(role: AppRole, rawStatus: unknown): MembershipStatus {
  if (role === "direction" || role === "staff" || role === "coach") {
    return "approved";
  }
  return normalizeMembershipStatus(rawStatus);
}

function resolveEspaceValidated(role: AppRole, rawValue: unknown): boolean {
  if (role === "direction" || role === "staff" || role === "coach") {
    return true;
  }
  return normalizeEspaceValidated(rawValue);
}

export type BuildMemberClerkMetadataInput = {
  disciplineIds: string[];
  espaceValidated?: boolean;
  membershipStatus?: MembershipStatus;
  registrationState?: RegistrationState;
};

export function buildMemberClerkMetadata(input: BuildMemberClerkMetadataInput): {
  privateMetadata: AppPrivateMetadata;
  publicMetadata: AppPublicMetadata;
} {
  const espaceValidated = input.espaceValidated ?? false;
  const membershipStatus = input.membershipStatus ?? "pending";
  const registrationState = input.registrationState ?? (espaceValidated ? "espace_active" : "pending");

  return {
    privateMetadata: {
      role: "member",
      membershipStatus,
      espaceValidated,
      disciplineIds: input.disciplineIds,
    },
    publicMetadata: {
      role: "member",
      membershipStatus,
      espaceValidated,
      disciplineIds: input.disciplineIds,
      registrationState,
    },
  };
}

export function isDirection(ctx: Pick<CurrentUserContext, "role">): boolean {
  return ctx.role === "direction";
}

export function isStaff(ctx: Pick<CurrentUserContext, "role">): boolean {
  return ctx.role === "staff";
}

export function isCoach(ctx: Pick<CurrentUserContext, "role">): boolean {
  return ctx.role === "coach";
}

export function canAccessMemberSpace(
  ctx: Pick<CurrentUserContext, "role" | "membershipStatus" | "espaceValidated">
): boolean {
  if (ctx.role === "coach" || ctx.role === "staff" || ctx.role === "direction") {
    return true;
  }
  return ctx.espaceValidated === true;
}

export function hasFullMembership(ctx: Pick<CurrentUserContext, "role" | "membershipStatus">): boolean {
  if (ctx.role === "coach" || ctx.role === "staff" || ctx.role === "direction") {
    return true;
  }
  return ctx.membershipStatus === "approved";
}

export function canAccessClubOperations(ctx: Pick<CurrentUserContext, "role">): boolean {
  return ctx.role === "staff" || ctx.role === "direction";
}

export function canManageSiteData(ctx: Pick<CurrentUserContext, "role">): boolean {
  return ctx.role === "direction";
}

export function canApproveCoachAbsences(ctx: Pick<CurrentUserContext, "role">): boolean {
  return ctx.role === "direction";
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const privateMetadata = (user.privateMetadata ?? {}) as AppPrivateMetadata;
  const publicMetadata = (user.publicMetadata ?? {}) as AppPublicMetadata;
  const firstEmail = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);

  const { role } = readRoleFromClerkUser(user);
  const rawMembershipStatus = privateMetadata.membershipStatus ?? publicMetadata.membershipStatus;
  const rawEspaceValidated = privateMetadata.espaceValidated ?? publicMetadata.espaceValidated;

  return {
    userId,
    email: firstEmail?.emailAddress ?? "",
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || "Membre",
    role,
    membershipStatus: resolveMembershipStatus(role, rawMembershipStatus),
    espaceValidated: resolveEspaceValidated(role, rawEspaceValidated),
    disciplineIds: normalizeDisciplineIds(privateMetadata, publicMetadata),
  };
}

export async function updateUserMetadata(
  userId: string,
  privateMetadata: AppPrivateMetadata,
  publicMetadata: Record<string, unknown> = {},
) {
  const client = await clerkClient();
  return client.users.updateUserMetadata(userId, {
    privateMetadata,
    publicMetadata,
  });
}

export async function deleteClerkUser(userId: string): Promise<void> {
  const client = await clerkClient();
  await client.users.deleteUser(userId);
}
