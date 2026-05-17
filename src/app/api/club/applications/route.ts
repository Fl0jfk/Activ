import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { isUserBureau, requireUser } from "@/lib/api-auth";
import { canAccessClubOperations, updateUserMetadata } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  buildRegistrationApplication,
  upsertMemberForApplication,
} from "@/lib/registration-application";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  const data = await readClubData();
  const admin = canAccessClubOperations(auth.value);

  if (admin) {
    return jsonOk(data.applications);
  }

  return jsonOk(data.applications.filter((entry) => entry.clerkUserId === auth.value.userId));
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const currentUser = auth.value;

  try {
    const payload = (await request.json()) as {
      disciplineId?: string;
      trialSlotId?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      postalCode?: string;
      city?: string;
      email?: string;
      motivation?: string;
      documents?: { name: string; url: string; uploadedAt: string }[];
    };

    if (
      !payload.disciplineId ||
      !payload.firstName ||
      !payload.lastName ||
      !payload.phone ||
      !payload.address ||
      !payload.postalCode ||
      !payload.city
    ) {
      return jsonError("Champs requis manquants.", 400);
    }

    const hasTrialRequest = Boolean(payload.trialSlotId);
    const data = await readClubData();
    if (hasTrialRequest && payload.trialSlotId && payload.disciplineId) {
      const validation = validateTrialSlotForRegistration(data, {
        disciplineId: payload.disciplineId,
        trialSlotId: payload.trialSlotId,
      });
      if (!validation.ok) {
        return jsonError(validation.message, validation.status);
      }
    }

    const alreadyApplied = data.applications.some(
      (entry) =>
        entry.clerkUserId === currentUser.userId &&
        entry.trialSlotId === (payload.trialSlotId ?? null) &&
        entry.status === "pending",
    );

    if (alreadyApplied) {
      return jsonError("Vous avez deja une demande en attente pour ce creneau.", 409);
    }

    const email = (payload.email?.trim() || currentUser.email).trim();
    const application = buildRegistrationApplication({
      disciplineId: payload.disciplineId,
      trialSlotId: hasTrialRequest ? payload.trialSlotId : null,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      address: payload.address,
      postalCode: payload.postalCode,
      city: payload.city,
      email,
      motivation: payload.motivation,
      documents: payload.documents,
      clerkUserId: currentUser.userId,
    });

    data.applications.unshift(application);
    upsertMemberForApplication(data.members, currentUser, email);
    await writeClubData(data);

    const isBureau = isUserBureau(currentUser);
    await updateUserMetadata(
      currentUser.userId,
      {
        role: currentUser.role,
        membershipStatus: isBureau ? "approved" : "pending",
      },
      {
        hasPendingRegistrationRequest: !isBureau,
        lastRegistrationRequestAt: application.createdAt,
      },
    );

    return jsonOk({ message: "Demande envoyee." }, 201);
  } catch (error) {
    console.error("Failed to create registration application", error);
    return jsonError("Erreur serveur.", 500);
  }
}
