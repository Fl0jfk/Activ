import { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { canAccessClubOperations } from "@/lib/clerk";
import { loadClubData, requireApplication, saveClubData } from "@/lib/club-repository";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";
import { addOneYearLicenseDate } from "@/lib/license-renewal";
import { notifyMemberPaymentReceipt } from "@/lib/payment-receipt-notify";
import { computeMembershipStatus, syncClerkAfterAdminPatch } from "@/lib/registration-clerk-sync";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";
import {
  applyContactValues,
  applyContactValuesToMember,
  mergeContactInput,
  validateContactValues,
  type MemberContactValues,
} from "@/lib/member-contact";
import { syncContactToClerk } from "@/lib/member-contact-clerk";

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
    const previousPaymentStatus = application.paymentStatus;
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

    const contactChanged =
      typeof payload.firstName === "string" ||
      typeof payload.lastName === "string" ||
      typeof payload.fullName === "string" ||
      typeof payload.email === "string" ||
      typeof payload.phone === "string" ||
      typeof payload.address === "string" ||
      typeof payload.postalCode === "string" ||
      typeof payload.city === "string";

    let contactValues: MemberContactValues | null = null;
    if (contactChanged) {
      contactValues = mergeContactInput(application, payload);
      const validation = validateContactValues(contactValues);
      if (!validation.ok) {
        return jsonError(validation.message, 400);
      }
      if (typeof payload.fullName === "string" && payload.fullName.trim()) {
        // Conserver la possibilité de ne transmettre que le nom complet.
        if (
          typeof payload.firstName !== "string" &&
          typeof payload.lastName !== "string"
        ) {
          const parts = payload.fullName.trim().split(/\s+/);
          contactValues = {
            ...contactValues,
            firstName: parts[0] ?? contactValues.firstName,
            lastName: parts.slice(1).join(" ") || contactValues.lastName,
          };
        }
      }
      applyContactValues(application, contactValues);
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

    const phaseExplicitlySet = typeof payload.dossierPhase === "string";

    if (application.status === "cancelled") {
      application.licenseEndDate = null;
    } else if (
      !phaseExplicitlySet &&
      application.status === "approved" &&
      application.paymentStatus === "paid"
    ) {
      application.dossierPhase = "finalized";
      if (!application.licenseEndDate) {
        application.licenseEndDate = addOneYearLicenseDate();
      }
    } else if (
      !phaseExplicitlySet &&
      application.status === "approved" &&
      application.paymentStatus !== "paid"
    ) {
      application.dossierPhase = "payment";
    } else if (
      application.status === "approved" &&
      application.paymentStatus === "paid" &&
      !application.licenseEndDate
    ) {
      application.licenseEndDate = addOneYearLicenseDate();
    }

    const computedMembershipStatus = computeMembershipStatus(application);

    const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
    if (member) {
      if (payload.role) {
        member.role = payload.role;
      }
      if (contactChanged) {
        applyContactValuesToMember(member, application);
      }
      member.membershipStatus = computedMembershipStatus;
      member.updatedAt = new Date().toISOString();
    }

    if (contactChanged) {
      // Une modification directe remplace une éventuelle demande en attente.
      for (const pending of data.contactChangeRequests ?? []) {
        if (pending.applicationId === application.id && pending.status === "pending") {
          pending.status = "rejected";
          pending.reviewedAt = new Date().toISOString();
          pending.reviewedBy = currentUser.fullName;
          pending.rejectionReason =
            "Coordonnées modifiées directement par le bureau.";
        }
      }
    }

    await saveClubData(data);

    let contactSyncWarning: string | null = null;
    if (contactValues && application.clerkUserId) {
      const contactSync = await syncContactToClerk({
        clerkUserId: application.clerkUserId,
        values: contactValues,
      });
      if (!contactSync.ok) {
        contactSyncWarning = contactSync.warning;
      }
    }

    const nextRole = payload.role ?? member?.role ?? "member";

    if (application.clerkUserId) {
      try {
        await syncClerkAfterAdminPatch({
          application,
          role: nextRole,
        });
      } catch (syncError) {
        console.error("Clerk sync failed after application patch (local update kept)", syncError);
        return jsonOk({
          message:
            "Mise a jour enregistree, mais la synchronisation Clerk a echoue. Verifiez le compte dans le dashboard Clerk si besoin.",
        });
      }
    }

    const justPaid = previousPaymentStatus !== "paid" && application.paymentStatus === "paid";
    if (justPaid) {
      const receipt = await notifyMemberPaymentReceipt(application);
      const baseMessage = receipt.sent
        ? "Mise a jour effectuee. Un recu PDF a ete envoye a l'adherent."
        : "Mise a jour effectuee. Le recu n'a pas pu etre envoye (e-mail manquant ou SMTP).";
      return jsonOk({
        message: contactSyncWarning
          ? `${baseMessage} ${contactSyncWarning}`
          : baseMessage,
        warning: contactSyncWarning ?? undefined,
      });
    }

    return jsonOk({
      message: contactSyncWarning
        ? `Mise a jour effectuee. ${contactSyncWarning}`
        : "Mise a jour effectuee.",
      warning: contactSyncWarning ?? undefined,
    });
  } catch (error) {
    console.error("Failed to update application", error);
    return jsonError("Erreur serveur.", 500);
  }
}
