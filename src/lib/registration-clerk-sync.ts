import type { ApplicationDossierPhase, RegistrationApplication } from "@/lib/club-data";
import {
  buildMemberClerkMetadata,
  type MembershipStatus,
  type RegistrationState,
  updateUserMetadata,
} from "@/lib/clerk";
import type { AppRole } from "@/lib/roles";

export function resolveRegistrationState(
  application: Pick<RegistrationApplication, "status" | "paymentStatus">,
  espaceValidated: boolean,
): RegistrationState {
  if (application.status === "rejected") {
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
  if (application.status === "rejected") {
    return "rejected";
  }
  return "pending";
}

export async function syncApplicationClerkMetadata(params: {
  application: RegistrationApplication;
  espaceValidated: boolean;
  membershipStatus: MembershipStatus;
  displayRole?: AppRole;
  hasPendingRegistrationRequest?: boolean;
}): Promise<void> {
  if (!params.application.clerkUserId) {
    return;
  }

  const disciplineIds = params.application.disciplineId ? [params.application.disciplineId] : [];
  const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
    disciplineIds,
    espaceValidated: params.espaceValidated,
    membershipStatus: params.membershipStatus,
    registrationState: resolveRegistrationState(params.application, params.espaceValidated),
  });

  await updateUserMetadata(params.application.clerkUserId, privateMetadata, {
    ...publicMetadata,
    displayRole: params.displayRole ?? "member",
    hasPendingRegistrationRequest: params.hasPendingRegistrationRequest,
  });
}

export async function syncClerkAfterEspaceValidation(application: RegistrationApplication): Promise<void> {
  await syncApplicationClerkMetadata({
    application,
    espaceValidated: true,
    membershipStatus: "pending",
    hasPendingRegistrationRequest: true,
  });
}

export async function syncClerkAfterAdminPatch(params: {
  application: RegistrationApplication;
  displayRole: AppRole;
}): Promise<void> {
  const membershipStatus = computeMembershipStatus(params.application);
  const espaceValidated = isEspaceValidatedPhase(params.application.dossierPhase);
  const finalRegistrationDone =
    params.application.status === "approved" && params.application.paymentStatus === "paid";

  await syncApplicationClerkMetadata({
    application: params.application,
    espaceValidated,
    membershipStatus,
    displayRole: params.displayRole,
    hasPendingRegistrationRequest: !finalRegistrationDone,
  });
}
