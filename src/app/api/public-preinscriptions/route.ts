import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { buildMemberClerkMetadata } from "@/lib/clerk";
import { parseClerkError } from "@/lib/clerk-errors";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  buildClubMemberRecord,
  buildRegistrationApplication,
} from "@/lib/registration-application";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

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
      return jsonError("Champs requis manquants.", 400);
    }
    if (payload.password.length < 8) {
      return jsonError("Le mot de passe doit contenir au moins 8 caracteres.", 400);
    }

    const withTrial = Boolean(payload.trialSlotId);
    const data = await readClubData();
    if (withTrial && payload.trialSlotId && payload.disciplineId) {
      const validation = validateTrialSlotForRegistration(data, {
        disciplineId: payload.disciplineId,
        trialSlotId: payload.trialSlotId,
      });
      if (!validation.ok) {
        return jsonError(validation.message, validation.status);
      }
    }

    const email = payload.email.trim().toLowerCase();
    const existingApplication = data.applications.some(
      (entry) => entry.email.trim().toLowerCase() === email && entry.status === "pending",
    );
    if (existingApplication) {
      return jsonError("Une demande est deja en attente pour cet email.", 409);
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
      data.applications.unshift(
        buildRegistrationApplication({
          disciplineId: payload.disciplineId,
          trialSlotId: withTrial ? payload.trialSlotId : null,
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          address: payload.address,
          postalCode: payload.postalCode,
          city: payload.city,
          email,
          motivation: payload.motivation,
          documents: payload.documents,
          clerkUserId: createdUser.id,
        }),
      );

      data.members.push(
        buildClubMemberRecord({
          clerkUserId: createdUser.id,
          fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
          email,
        }),
      );

      await writeClubData(data);
      return jsonOk(
        {
          message:
            "Pre-inscription envoyee et compte cree. Votre espace membre sera active apres validation par le bureau.",
        },
        201,
      );
    } catch (error) {
      await client.users.deleteUser(createdUser.id);
      throw error;
    }
  } catch (error) {
    const parsedError = parseClerkError(error);
    console.error("Failed to create public pre-registration", error);
    return jsonError(parsedError.message, parsedError.status);
  }
}
