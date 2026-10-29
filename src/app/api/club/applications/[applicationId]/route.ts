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

    if (contactChanged) {
      if (typeof payload.email === "string") {
        const email = payload.email.trim().toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return jsonError("Adresse e-mail invalide.", 400);
        }
        application.email = email;
      }

      if (typeof payload.firstName === "string" || typeof payload.lastName === "string") {
        const firstName =
          typeof payload.firstName === "string"
            ? payload.firstName.trim()
            : application.firstName?.trim() ?? "";
        const lastName =
          typeof payload.lastName === "string"
            ? payload.lastName.trim()
            : application.lastName?.trim() ?? "";
        application.firstName = firstName;
        application.lastName = lastName;
        application.fullName =
          `${firstName} ${lastName}`.trim() ||
          application.fullName.trim() ||
          application.email;
      } else if (typeof payload.fullName === "string" && payload.fullName.trim()) {
        application.fullName = payload.fullName.trim();
      }

      if (typeof payload.phone === "string") {
        application.phone = payload.phone.trim();
      }
      if (typeof payload.address === "string") {
        application.address = payload.address.trim();
      }
      if (typeof payload.postalCode === "string") {
        application.postalCode = payload.postalCode.trim();
      }
      if (typeof payload.city === "string") {
        application.city = payload.city.trim();
      }
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
        member.fullName = application.fullName;
        member.email = application.email;
      }
      member.membershipStatus = computedMembershipStatus;
      member.updatedAt = new Date().toISOString();
    }

    await saveClubData(data);

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
      return jsonOk({
        message: receipt.sent
          ? "Mise a jour effectuee. Un recu PDF a ete envoye a l'adherent."
          : "Mise a jour effectuee. Le recu n'a pas pu etre envoye (e-mail manquant ou SMTP).",
      });
    }

    return jsonOk({ message: "Mise a jour effectuee." });
  } catch (error) {
    console.error("Failed to update application", error);
    return jsonError("Erreur serveur.", 500);
  }
}
