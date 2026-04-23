import { auth, clerkClient } from "@clerk/nextjs/server";

export type AppRole = "admin" | "member" | "coach";
export type MembershipStatus = "pending" | "approved" | "rejected";

export type AppPrivateMetadata = {
  role?: AppRole;
  functions?: string[];
  membershipStatus?: MembershipStatus;
};

export type AppPublicMetadata = {
  functions?: string[];
  displayRole?: string;
};

export type CurrentUserContext = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  privateFunctions: string[];
  publicFunctions: string[];
  membershipStatus: MembershipStatus;
};

function normalizeRole(value: unknown): AppRole {
  return value === "admin" || value === "coach" ? value : "member";
}

function normalizeMembershipStatus(value: unknown): MembershipStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }
  return "pending";
}

function normalizeFunctions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function isAdminRole(role: AppRole, functions: string[]) {
  return role === "admin" || functions.includes("president") || functions.includes("secretary");
}

export function canAccessAdminSpace(publicFunctions: string[]) {
  return publicFunctions.includes("president") || publicFunctions.includes("secretary");
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

  return {
    userId,
    email: firstEmail?.emailAddress ?? "",
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || "Membre",
    role: normalizeRole(privateMetadata.role),
    privateFunctions: normalizeFunctions(privateMetadata.functions),
    publicFunctions: normalizeFunctions(publicMetadata.functions),
    membershipStatus: normalizeMembershipStatus(privateMetadata.membershipStatus),
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
