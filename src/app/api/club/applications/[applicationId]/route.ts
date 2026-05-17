import { NextRequest, NextResponse } from "next/server";
import { type ApplicationDossierPhase, readClubData, writeClubData } from "@/lib/club-data";
import {
  buildMemberClerkMetadata,
  canAccessClubOperations,
  getCurrentUserContext,
  updateUserMetadata,
} from "@/lib/clerk";

function resolveRegistrationState(
  application: { status: string; paymentStatus: string; dossierPhase?: ApplicationDossierPhase },
  espaceValidated: boolean,
): "pending" | "espace_active" | "registered" | "rejected" {
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

function isEspaceValidated(phase: ApplicationDossierPhase | undefined): boolean {
  return phase === "documents" || phase === "payment" || phase === "finalized";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }
  const isAdmin = canAccessClubOperations(currentUser);

  const { applicationId } = await context.params;

  try {
    const payload = (await request.json()) as {
      status?: "pending" | "awaiting_document" | "approved" | "rejected";
      trialAttended?: boolean;
      paymentStatus?: "unpaid" | "partial" | "paid";
      paymentMethod?: "cash" | "check" | "bank_transfer" | "card" | "other" | "";
      notes?: string;
      role?: "member" | "staff" | "coach" | "direction";
      licenseEndDate?: string | null;
      trialSlotId?: string;
      dossierPhase?: ApplicationDossierPhase;
    };

    const data = await readClubData();
    const application = data.applications.find((entry) => entry.id === applicationId);
    if (!application) {
      return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
    }
    const isOwner = application.clerkUserId !== null && application.clerkUserId === currentUser.userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ message: "Non autorise." }, { status: 401 });
    }

    if (!isAdmin && payload.trialSlotId) {
      const slot = data.trialSlots.find((entry) => entry.id === payload.trialSlotId && entry.active);
      if (!slot) {
        return NextResponse.json({ message: "Creneau d'essai introuvable." }, { status: 404 });
      }
      application.trialSlotId = payload.trialSlotId;
      application.requestKind = "trial_and_preregistration";
      await writeClubData(data);
      return NextResponse.json({ message: "Demande d'essai ajoutee." });
    }

    if (!isAdmin) {
      return NextResponse.json({ message: "Non autorise." }, { status: 401 });
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

    const finalRegistrationDone =
      application.status === "approved" && application.paymentStatus === "paid";
    const computedMembershipStatus = finalRegistrationDone
      ? "approved"
      : application.status === "rejected"
        ? "rejected"
        : "pending";

    const espaceValidated = isEspaceValidated(application.dossierPhase);
    const disciplineIds = application.disciplineId ? [application.disciplineId] : [];

    const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
    if (member) {
      if (payload.role) {
        member.role = payload.role;
      }
      member.membershipStatus = computedMembershipStatus;
      member.updatedAt = new Date().toISOString();
    }

    await writeClubData(data);

    const nextRole = payload.role ?? member?.role ?? "member";

    if (application.clerkUserId) {
      const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
        disciplineIds,
        espaceValidated,
        membershipStatus: computedMembershipStatus,
        registrationState: resolveRegistrationState(application, espaceValidated),
      });
      await updateUserMetadata(application.clerkUserId, privateMetadata, {
        ...publicMetadata,
        displayRole: nextRole,
        hasPendingRegistrationRequest: !finalRegistrationDone,
      });
    }

    return NextResponse.json({ message: "Mise a jour effectuee." });
  } catch (error) {
    console.error("Failed to update application", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
