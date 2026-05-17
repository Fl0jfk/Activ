import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { buildMemberClerkMetadata } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseClerkError(error: unknown): { message: string; status: number } {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const first = (error as { errors: Array<{ code?: string; message?: string }> }).errors[0];
    const code = first?.code;
    if (code === "form_identifier_exists") {
      return { message: "Cette adresse email est deja utilisee. Connecte-toi ou utilise une autre adresse.", status: 409 };
    }
    if (code === "form_password_pwned") {
      return { message: "Ce mot de passe n'est pas assez securise. Choisis-en un autre.", status: 400 };
    }
    if (code === "form_password_length_too_short") {
      return { message: "Le mot de passe doit contenir au moins 8 caracteres.", status: 400 };
    }
    if (first?.message) {
      return { message: first.message, status: 400 };
    }
  }
  return { message: "Erreur serveur.", status: 500 };
}

export async function POST(request: NextRequest) {
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
      password?: string;
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
      !payload.city ||
      !payload.email ||
      !payload.password
    ) {
      return NextResponse.json({ message: "Champs requis manquants." }, { status: 400 });
    }
    if (payload.password.length < 8) {
      return NextResponse.json({ message: "Le mot de passe doit contenir au moins 8 caracteres." }, { status: 400 });
    }

    const withTrial = Boolean(payload.trialSlotId);
    const data = await readClubData();
    if (withTrial) {
      const slot = data.trialSlots.find((entry) => entry.id === payload.trialSlotId && entry.active);
      if (!slot) {
        return NextResponse.json({ message: "Creneau d'essai introuvable." }, { status: 404 });
      }
      if (slot.disciplineId !== payload.disciplineId) {
        return NextResponse.json({ message: "Ce creneau ne correspond pas a la discipline choisie." }, { status: 400 });
      }
      if (new Date(slot.startsAt).getTime() < Date.now()) {
        return NextResponse.json({ message: "Ce creneau d'essai est passe." }, { status: 400 });
      }
      const registered = data.applications.filter(
        (entry) => entry.trialSlotId === slot.id && entry.status !== "rejected",
      ).length;
      if (registered >= slot.capacity) {
        return NextResponse.json({ message: "Ce creneau d'essai est complet." }, { status: 409 });
      }
    }

    const email = payload.email.trim().toLowerCase();
    const existingApplication = data.applications.some((entry) => entry.email.trim().toLowerCase() === email && entry.status === "pending");
    if (existingApplication) {
      return NextResponse.json({ message: "Une demande est deja en attente pour cet email." }, { status: 409 });
    }

    const disciplineIds = [payload.disciplineId];
    const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
      disciplineIds,
      espaceValidated: false,
      membershipStatus: "pending",
      registrationState: "pending",
    });

    const client = await clerkClient();
    const createdUser = await client.users.createUser({
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      emailAddress: [email],
      password: payload.password,
      privateMetadata,
      publicMetadata,
    });

    try {
      data.applications.unshift({
        id: randomId("app"),
        clerkUserId: createdUser.id,
        fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
        email,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        postalCode: payload.postalCode.trim(),
        city: payload.city.trim(),
        documents: Array.isArray(payload.documents) ? payload.documents : [],
        requestKind: "trial_and_preregistration",
        disciplineId: payload.disciplineId,
        trialSlotId: withTrial ? (payload.trialSlotId ?? null) : null,
        motivation: payload.motivation?.trim() ?? "",
        createdAt: new Date().toISOString(),
        status: "pending",
        dossierPhase: "reception",
        trialAttended: false,
        paymentStatus: "unpaid",
        paymentMethod: "",
        licenseEndDate: null,
        notes: "",
      });

      data.members.push({
        clerkUserId: createdUser.id,
        fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
        email,
        role: "member",
        functions: [],
        membershipStatus: "pending",
        updatedAt: new Date().toISOString(),
      });

      await writeClubData(data);
      return NextResponse.json(
        {
          message:
            "Pre-inscription envoyee et compte cree. Votre espace membre sera active apres validation par le bureau.",
        },
        { status: 201 },
      );
    } catch (error) {
      await client.users.deleteUser(createdUser.id);
      throw error;
    }
  } catch (error) {
    const parsedError = parseClerkError(error);
    console.error("Failed to create public pre-registration", error);
    return NextResponse.json({ message: parsedError.message }, { status: parsedError.status });
  }
}
