import type { ApplicationDossierPhase, RegistrationApplication } from "@/lib/club-data";
import {
  buildMemberClerkMetadata,
  type MembershipStatus,
  type RegistrationState,
  updateUserMetadata,
} from "@/lib/clerk";
import { readRoleFromClerkUser } from "@/lib/clerk-role";
import type { AppRole } from "@/lib/roles";
import { isBureauRole } from "@/lib/roles";
import { clerkClient } from "@clerk/nextjs/server";

export function resolveRegistrationState(
  application: Pick<RegistrationApplication, "status" | "paymentStatus">,
  espaceValidated: boolean,
): RegistrationState {
  if (application.status === "rejected" || application.status === "cancelled") {
    return "rejected";
  }
  if (application.status === "approved" && application.paymentStatus === "paid") {
    return "registered";
  }
  if (espaceValidated) {
    return "espace_active";
  }
  return "pending";
}

export function isEspaceValidatedPhase(phase: ApplicationDossierPhase | undefined): boolean {
  return phase === "documents" || phase === "payment" || phase === "finalized";
}

export function computeMembershipStatus(
  application: Pick<RegistrationApplication, "status" | "paymentStatus">,
): MembershipStatus {
  const finalRegistrationDone =
    application.status === "approved" && application.paymentStatus === "paid";
  if (finalRegistrationDone) {
    return "approved";
  }
  if (application.status === "rejected" || application.status === "cancelled") {
    return "rejected";
  }
  return "pending";
}

/** Ne pas écraser un rôle bureau/coach déjà présent côté Clerk. */
async function resolveEffectiveSyncRole(
  clerkUserId: string,
  preferredRole: AppRole,
): Promise<AppRole> {
  if (isBureauRole(preferredRole)) {
    return preferredRole;
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const existing = readRoleFromClerkUser(user).role;
    if (isBureauRole(existing)) {
      return existing;
    }
  } catch (error) {
    console.error("resolveEffectiveSyncRole: unable to read Clerk role", { clerkUserId, error });
  }
  return preferredRole;
}

export async function syncApplicationClerkMetadata(params: {
  application: RegistrationApplication;
  espaceValidated: boolean;
  membershipStatus: MembershipStatus;
  /** Rôle métier à écrire dans Clerk (`role` private + public). */
  role?: AppRole;
  hasPendingRegistrationRequest?: boolean;
}): Promise<void> {
  if (!params.application.clerkUserId) {
    return;
  }

  const role = await resolveEffectiveSyncRole(
    params.application.clerkUserId,
    params.role ?? "member",
  );
  const bureauBypass = isBureauRole(role);
  const disciplineIds = params.application.disciplineId ? [params.application.disciplineId] : [];
  const espaceValidated = bureauBypass ? true : params.espaceValidated;
  const membershipStatus = bureauBypass ? "approved" : params.membershipStatus;
  const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
    disciplineIds,
    role,
    espaceValidated,
    membershipStatus,
    registrationState: resolveRegistrationState(params.application, espaceValidated),
  });

  await updateUserMetadata(params.application.clerkUserId, privateMetadata, {
    ...publicMetadata,
    hasPendingRegistrationRequest: bureauBypass
      ? false
      : params.hasPendingRegistrationRequest,
  });
}

export async function syncClerkAfterEspaceValidation(
  application: RegistrationApplication,
  role: AppRole = "member",
): Promise<void> {
  await syncApplicationClerkMetadata({
    application,
    espaceValidated: true,
    membershipStatus: "pending",
    role,
    hasPendingRegistrationRequest: true,
  });
}

export async function syncClerkAfterAdminPatch(params: {
  application: RegistrationApplication;
  role: AppRole;
}): Promise<void> {
  const membershipStatus = computeMembershipStatus(params.application);
  const espaceValidated = isEspaceValidatedPhase(params.application.dossierPhase);
  const finalRegistrationDone =
    params.application.status === "approved" && params.application.paymentStatus === "paid";
  const bureauBypass = isBureauRole(params.role);

  await syncApplicationClerkMetadata({
    application: params.application,
    espaceValidated,
    membershipStatus,
    role: params.role,
    hasPendingRegistrationRequest: bureauBypass ? false : !finalRegistrationDone,
  });
}
