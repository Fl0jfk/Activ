import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requirePresident, requireUser } from "@/lib/api-auth";
import {
  actorName,
  readJsonBody,
  rejectionResponse,
} from "@/lib/application-route-utils";
import { canAccessClubOperations } from "@/lib/clerk";
import { updateClubData } from "@/lib/club-data";
import type { LifecycleEmailKind, RegistrationApplication } from "@/lib/club-data";
import {
  TransitionRejection,
  applyTransition,
  isClosedApplication,
  parseApplicationPatch,
  validatePatch,
} from "@/lib/dossier-transitions";
import { claimLifecycleEmail, queueLifecycleEmail } from "@/lib/lifecycle-emails";
import {
  applyContactValues,
  applyContactValuesToMember,
  mergeContactInput,
  validateContactValues,
  type MemberContactValues,
} from "@/lib/member-contact";
import { syncContactToClerk } from "@/lib/member-contact-clerk";
import { receiptFailureSentence, sendPaymentReceipt } from "@/lib/payment-receipt-notify";
import { computeClerkAccessState, syncClerkForApplication } from "@/lib/registration-clerk-sync";
import { isBureauRole, type AppRole } from "@/lib/roles";
import { readSiteData } from "@/lib/site-data";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

type PatchOutcome = {
  application: RegistrationApplication;
  mine: RegistrationApplication[];
  stateChanged: boolean;
  finalizing: boolean;
  roleChange: AppRole | null;
  memberRole: AppRole;
  contactValues: MemberContactValues | null;
  disciplinesChanged: boolean;
  emails: Exclude<LifecycleEmailKind, "finalized">[];
};

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
  const raw = await readJsonBody(request);
  if (raw === undefined) {
    return jsonError("Corps de requête invalide.", 400);
  }

  try {
    const patch = parseApplicationPatch(raw);

    /* L'adhérent peut seulement ajouter un créneau d'essai à son propre dossier ouvert. */
    if (!isAdmin) {
      const trialSlotId = patch.trialSlotId;
      if (!trialSlotId) {
        return jsonError("Non autorisé.", 401);
      }
      await updateClubData((data) => {
        const application = data.applications.find((entry) => entry.id === applicationId);
        if (!application) {
          throw new TransitionRejection("Demande introuvable.", 404);
        }
        if (!application.clerkUserId || application.clerkUserId !== currentUser.userId) {
          throw new TransitionRejection("Non autorisé.", 401);
        }
        if (isClosedApplication(application)) {
          throw new TransitionRejection(
            "Ce dossier est clos : déposez une nouvelle pré-inscription pour demander un essai.",
            409,
          );
        }
        const validation = validateTrialSlotForRegistration(data, {
          disciplineId: application.disciplineId,
          trialSlotId,
        });
        if (!validation.ok) {
          throw new TransitionRejection(validation.message, validation.status);
        }
        application.trialSlotId = trialSlotId;
        application.requestKind = "trial_and_preregistration";
      });
      return jsonOk({ message: "Demande d'essai ajoutée." });
    }

    /* Changer un rôle est réservé au président (et jamais sur son propre compte). */
    if (patch.role !== undefined) {
      const president = await requirePresident();
      if (!president.ok) {
        return president.response;
      }
    }

    let nextDisciplineIds: string[] | null = null;
    if (patch.disciplineIds) {
      const siteData = await readSiteData();
      const knownIds = new Set(siteData.disciplines.map((discipline) => discipline.id));
      nextDisciplineIds = Array.from(
        new Set(
          patch.disciplineIds.map((id) => id.trim()).filter((id) => knownIds.has(id)),
        ),
      );
      if (nextDisciplineIds.length === 0) {
        return jsonError("Choisissez au moins une activité.", 400);
      }
    }

    const actor = actorName(currentUser);

    const outcome = await updateClubData<PatchOutcome>((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (!application) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }

      const contactChanged =
        patch.firstName !== undefined ||
        patch.lastName !== undefined ||
        patch.fullName !== undefined ||
        patch.email !== undefined ||
        patch.phone !== undefined ||
        patch.address !== undefined ||
        patch.postalCode !== undefined ||
        patch.city !== undefined;

      let contactValues: MemberContactValues | null = null;
      if (contactChanged) {
        contactValues = mergeContactInput(application, patch);
        const validation = validateContactValues(contactValues);
        if (!validation.ok) {
          throw new TransitionRejection(validation.message, 400);
        }
        if (
          patch.fullName?.trim() &&
          patch.firstName === undefined &&
          patch.lastName === undefined
        ) {
          // Conserver la possibilité de ne transmettre que le nom complet.
          const parts = patch.fullName.trim().split(/\s+/);
          contactValues = {
            ...contactValues,
            firstName: parts[0] ?? contactValues.firstName,
            lastName: parts.slice(1).join(" ") || contactValues.lastName,
          };
        }
      }

      const plan = validatePatch(application, patch);

      const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
      let roleChange: AppRole | null = null;
      if (patch.role !== undefined) {
        if (!application.clerkUserId || !member) {
          throw new TransitionRejection(
            "Aucun compte adhérent n’est lié à ce dossier : son rôle ne peut pas être modifié.",
            409,
          );
        }
        if (application.clerkUserId === currentUser.userId) {
          throw new TransitionRejection("Vous ne pouvez pas modifier votre propre rôle.", 403);
        }
        if (patch.role !== member.role) {
          roleChange = patch.role;
        }
      }

      if (contactValues) {
        applyContactValues(application, contactValues);
        // Une modification directe remplace une éventuelle demande en attente.
        const now = new Date().toISOString();
        for (const pending of data.contactChangeRequests ?? []) {
          if (pending.applicationId === application.id && pending.status === "pending") {
            pending.status = "rejected";
            pending.reviewedAt = now;
            pending.reviewedBy = currentUser.fullName;
            pending.rejectionReason = "Coordonnées modifiées directement par le bureau.";
          }
        }
      }

      let disciplinesChanged = false;
      if (nextDisciplineIds) {
        application.disciplineIds = nextDisciplineIds;
        application.disciplineId = nextDisciplineIds[0]!;
        application.disciplinesSetByBureau = true;
        if (application.membershipBulletin) {
          application.membershipBulletin.selectedDisciplineIds = nextDisciplineIds;
        }
        disciplinesChanged = true;
      }

      if (typeof patch.trialAttended === "boolean") application.trialAttended = patch.trialAttended;
      if (typeof patch.paymentMethod === "string" && !plan.finalizing) {
        application.paymentMethod = patch.paymentMethod;
      }
      if (typeof patch.notes === "string") application.notes = patch.notes;
      if (typeof patch.memberMessage === "string") application.memberMessage = patch.memberMessage.trim();
      if (patch.amountPaid !== undefined && !plan.finalizing) {
        application.amountPaid = patch.amountPaid;
      }

      applyTransition(data, application, plan, patch, { actor });

      const mine = data.applications.filter(
        (entry) => entry.clerkUserId !== null && entry.clerkUserId === application.clerkUserId,
      );
      if (member) {
        if (roleChange) member.role = roleChange;
        if (contactValues) applyContactValuesToMember(member, application);
        member.membershipStatus = isBureauRole(member.role)
          ? "approved"
          : computeClerkAccessState(mine).membershipStatus;
        member.updatedAt = new Date().toISOString();
      }

      const emails: PatchOutcome["emails"] = [];
      if (plan.enteringPayment && application.status === "approved") {
        if (claimLifecycleEmail(application, "payment_expected")) emails.push("payment_expected");
      }
      if (plan.cancelling && claimLifecycleEmail(application, "cancelled")) {
        emails.push("cancelled");
      }

      return {
        application: structuredClone(application),
        mine: structuredClone(mine),
        stateChanged: plan.stateChanged,
        finalizing: plan.finalizing,
        roleChange,
        memberRole: member?.role ?? "member",
        contactValues,
        disciplinesChanged,
        emails,
      };
    });

    /* Les données sont enregistrées : tout ce qui suit ne peut plus provoquer d'erreur 500. */
    const warnings: string[] = [];
    const { application } = outcome;

    if (outcome.contactValues && application.clerkUserId) {
      const contactSync = await syncContactToClerk({
        clerkUserId: application.clerkUserId,
        values: outcome.contactValues,
      });
      if (!contactSync.ok) warnings.push(contactSync.warning);
    }

    if (
      application.clerkUserId &&
      (outcome.stateChanged || outcome.roleChange || outcome.disciplinesChanged)
    ) {
      const sync = await syncClerkForApplication(application, {
        applications: outcome.mine,
        role: outcome.roleChange ?? outcome.memberRole,
        explicitRole: Boolean(outcome.roleChange),
      });
      if (!sync.ok) warnings.push(sync.warning);
    }

    let receipt: { sent: boolean; reason?: string } | undefined;
    let message = "Mise à jour effectuée.";
    if (outcome.finalizing) {
      const result = await sendPaymentReceipt(application.id);
      if (result.sent) {
        receipt = { sent: true };
        message = "Mise à jour effectuée. Une attestation de paiement a été envoyée à l’adhérent.";
      } else {
        receipt = { sent: false, reason: result.reason };
        warnings.push(receiptFailureSentence(result));
        message = "Mise à jour effectuée.";
      }
    }

    for (const kind of outcome.emails) {
      queueLifecycleEmail(kind, application);
    }

    const warning = warnings.length > 0 ? warnings.join(" ") : undefined;
    return jsonOk({
      message: warning ? `${message} ${warning}` : message,
      warning,
      receipt,
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to update application", error);
    return jsonError("Erreur serveur.", 500);
  }
}
