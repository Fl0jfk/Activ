import { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { canAccessClubOperations } from "@/lib/clerk";
import { loadClubData, requireApplication, saveClubData } from "@/lib/club-repository";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";
import { computeMembershipStatus, syncClerkAfterAdminPatch } from "@/lib/registration-clerk-sync";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const currentUser = auth.value;
  const isAdmin = canAccessClubOperations(currentUser);

  const { applicationId } = await context.params;

  try {
    const payload = (await request.json()) as ApplicationUpdatePayload;

    const data = await loadClubData();
    const applicationResult = requireApplication(data, applicationId);
    if (applicationResult instanceof NextResponse) {
      return applicationResult;
    }
    const application = applicationResult;
    const isOwner = application.clerkUserId !== null && application.clerkUserId === currentUser.userId;

    if (!isAdmin && !isOwner) {
      return jsonError("Non autorisé.", 401);
    }

    if (!isAdmin && payload.trialSlotId) {
      const validation = validateTrialSlotForRegistration(data, {
        disciplineId: application.disciplineId,
        trialSlotId: payload.trialSlotId,
      });
      if (!validation.ok) {
        return jsonError(validation.message, validation.status);
      }
      application.trialSlotId = payload.trialSlotId;
      application.requestKind = "trial_and_preregistration";
      await saveClubData(data);
      return jsonOk({ message: "Demande d'essai ajoutee." });
    }

    if (!isAdmin) {
      return jsonError("Non autorisé.", 401);
    }

    if (payload.status) {
      application.status = payload.status;
    }
    if (typeof payload.trialAttended === "boolean") {
      application.trialAttended = payload.trialAttended;
    }
    if (payload.paymentStatus) {
      application.paymentStatus = payload.paymentStatus;
    }
    if (typeof payload.paymentMethod === "string") {
      application.paymentMethod = payload.paymentMethod;
    }
    if (typeof payload.notes === "string") {
      application.notes = payload.notes;
    }
    if (payload.licenseEndDate === null || typeof payload.licenseEndDate === "string") {
      application.licenseEndDate = payload.licenseEndDate;
    }
    if (payload.dossierPhase) {
      application.dossierPhase = payload.dossierPhase;
    }

    if (application.status === "approved" && application.paymentStatus === "paid") {
      application.dossierPhase = "finalized";
    } else if (application.status === "approved" && application.paymentStatus !== "paid") {
      application.dossierPhase = "payment";
    }

    const computedMembershipStatus = computeMembershipStatus(application);

    const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
    if (member) {
      if (payload.role) {
        member.role = payload.role;
      }
      member.membershipStatus = computedMembershipStatus;
      member.updatedAt = new Date().toISOString();
    }

    await saveClubData(data);

    const nextRole = payload.role ?? member?.role ?? "member";

    if (application.clerkUserId) {
      await syncClerkAfterAdminPatch({
        application,
        displayRole: nextRole,
      });
    }

    return jsonOk({ message: "Mise a jour effectuee." });
  } catch (error) {
    console.error("Failed to update application", error);
    return jsonError("Erreur serveur.", 500);
  }
}
