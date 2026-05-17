import { NextRequest, NextResponse } from "next/server";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  canAccessClubOperations,
  getCurrentUserContext,
  isCoach,
  isDirection,
  isStaff,
  updateUserMetadata,
} from "@/lib/clerk";

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET() {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const data = await readClubData();
  const admin = canAccessClubOperations(currentUser);

  if (admin) {
    return NextResponse.json(data.applications);
  }

  return NextResponse.json(data.applications.filter((entry) => entry.clerkUserId === currentUser.userId));
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

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
      return NextResponse.json({ message: "Champs requis manquants." }, { status: 400 });
    }

    const hasTrialRequest = Boolean(payload.trialSlotId);
    const data = await readClubData();
    if (hasTrialRequest) {
      const slot = data.trialSlots.find((entry) => entry.id === payload.trialSlotId && entry.active);
      if (!slot) {
        return NextResponse.json({ message: "Creneau d'essai introuvable." }, { status: 404 });
      }
    }

    const alreadyApplied = data.applications.some(
      (entry) =>
        entry.clerkUserId === currentUser.userId &&
        entry.trialSlotId === (payload.trialSlotId ?? null) &&
        entry.status === "pending",
    );

    if (alreadyApplied) {
      return NextResponse.json({ message: "Vous avez deja une demande en attente pour ce creneau." }, { status: 409 });
    }

    const createdAt = new Date().toISOString();

    data.applications.unshift({
      id: randomId("app"),
      clerkUserId: currentUser.userId,
      fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
      email: (payload.email?.trim() || currentUser.email).trim(),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone.trim(),
      address: payload.address.trim(),
      postalCode: payload.postalCode.trim(),
      city: payload.city.trim(),
      documents: Array.isArray(payload.documents) ? payload.documents : [],
      requestKind: "trial_and_preregistration",
      disciplineId: payload.disciplineId,
      trialSlotId: hasTrialRequest ? (payload.trialSlotId ?? null) : null,
      motivation: payload.motivation?.trim() ?? "",
      createdAt,
      status: "pending",
      dossierPhase: "reception",
      trialAttended: false,
      paymentStatus: "unpaid",
      paymentMethod: "",
      licenseEndDate: null,
      notes: "",
    });

    const existingMember = data.members.find((entry) => entry.clerkUserId === currentUser.userId);
    if (existingMember) {
      existingMember.fullName = currentUser.fullName;
      existingMember.email = (payload.email?.trim() || currentUser.email).trim();
      existingMember.updatedAt = createdAt;
    } else {
      data.members.push({
        clerkUserId: currentUser.userId,
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role,
        functions: [],
        membershipStatus: "pending",
        updatedAt: createdAt,
      });
    }

    await writeClubData(data);

    const isBureau = isDirection(currentUser) || isStaff(currentUser) || isCoach(currentUser);
    await updateUserMetadata(
      currentUser.userId,
      {
        role: currentUser.role,
        membershipStatus: isBureau ? "approved" : "pending",
      },
      {
        hasPendingRegistrationRequest: !isBureau,
        lastRegistrationRequestAt: createdAt,
      }
    );

    return NextResponse.json({ message: "Demande envoyee." }, { status: 201 });
  } catch (error) {
    console.error("Failed to create registration application", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
