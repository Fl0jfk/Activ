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
import { notifyBureauNewPreinscription } from "@/lib/preinscription-notify";
import {
  buildMembershipBulletinRecord,
  resolvePrimaryDisciplineId,
  validateMembershipBulletinPayload,
  type MembershipBulletinFormPayload,
} from "@/lib/membership-bulletin";
import { buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";
import { sendEmail } from "@/lib/mailer";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { readSiteData } from "@/lib/site-data";
import { uploadBytesToS3 } from "@/lib/s3-upload";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as MembershipBulletinFormPayload & {
      bulletinMode?: boolean;
      disciplineId?: string;
      trialSlotId?: string;
      motivation?: string;
      documents?: { name: string; url: string; uploadedAt: string }[];
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      postalCode?: string;
      city?: string;
      email?: string;
      password?: string;
    };

    if (payload.bulletinMode) {
      return handleBulletinSubmission(payload);
    }

    return handleLegacySubmission(payload);
  } catch (error) {
    const parsedError = parseClerkError(error);
    console.error("Failed to create public pre-registration", error);
    return jsonError(parsedError.message, parsedError.status);
  }
}

async function handleBulletinSubmission(payload: MembershipBulletinFormPayload & { bulletinMode?: boolean }) {
  const validation = validateMembershipBulletinPayload(payload, { requirePassword: true });
  if (!validation.ok) {
    return jsonError(validation.message, 400);
  }

  const email = payload.email.trim().toLowerCase();
  const data = await readClubData();
  const existingApplication = data.applications.some(
    (entry) => entry.email.trim().toLowerCase() === email && entry.status === "pending",
  );
  if (existingApplication) {
    return jsonError("Une demande est déjà en attente pour cet email.", 409);
  }

  const siteData = await readSiteData();
  const disciplines = getActiveDisciplineOptions(siteData);
  const disciplineId = resolvePrimaryDisciplineId(payload.selectedSlots, disciplines);
  if (!disciplineId) {
    return jsonError("Impossible de rattacher une discipline. Réessayez plus tard.", 400);
  }

  const disciplineIds = [disciplineId];
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
    const pdfBytes = await buildMembershipBulletinPdf(payload);
    const uploadedPdf = await uploadBytesToS3({
      body: pdfBytes,
      keyPrefix: "data/club-documents/bulletins",
      fileName: `bulletin-adhesion-${payload.lastName.trim().toLowerCase()}.pdf`,
      contentType: "application/pdf",
      userSegment: createdUser.id,
    });

    const membershipBulletin = buildMembershipBulletinRecord(payload);
    const application = buildRegistrationApplication({
      disciplineId,
      trialSlotId: null,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      address: payload.address,
      postalCode: payload.postalCode,
      city: payload.city,
      email,
      motivation: "",
      documents: [uploadedPdf],
      clerkUserId: createdUser.id,
      membershipBulletin,
    });

    data.applications.unshift(application);
    data.members.push(
      buildClubMemberRecord({
        clerkUserId: createdUser.id,
        fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
        email,
      }),
    );
    await writeClubData(data);

    await notifyBureauNewPreinscription({
      application,
      trialSlots: data.trialSlots,
    });

    await sendEmail({
      to: email,
      subject: "[Activ'] Votre bulletin d'adhésion signé",
      text: "Bonjour,\n\nVeuillez trouver en pièce jointe votre bulletin d'adhésion signé.\nLe bureau traitera votre dossier prochainement.\n\nSportivement,\nL'équipe Activ'",
      html: "<p>Bonjour,</p><p>Veuillez trouver en pièce jointe votre <strong>bulletin d'adhésion signé</strong>.</p><p>Le bureau traitera votre dossier prochainement.</p><p>Sportivement,<br/>L'équipe Activ'</p>",
      attachments: [
        {
          filename: uploadedPdf.name,
          content: pdfBytes,
          contentType: "application/pdf",
        },
      ],
    });

    return jsonOk(
      {
        message:
          "Bulletin d'adhésion envoyé et compte créé. Votre espace membre sera activé après validation par le bureau.",
      },
      201,
    );
  } catch (error) {
    await client.users.deleteUser(createdUser.id);
    throw error;
  }
}

async function handleLegacySubmission(payload: {
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
}) {
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
    return jsonError("Le mot de passe doit contenir au moins 8 caractères.", 400);
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
    return jsonError("Une demande est déjà en attente pour cet email.", 409);
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
    const application = buildRegistrationApplication({
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
    });

    data.applications.unshift(application);
    data.members.push(
      buildClubMemberRecord({
        clerkUserId: createdUser.id,
        fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim(),
        email,
      }),
    );

    await writeClubData(data);
    await notifyBureauNewPreinscription({
      application,
      trialSlots: data.trialSlots,
    });
    return jsonOk(
      {
        message:
          "Pré-inscription envoyée et compte créé. Votre espace membre sera activé après validation par le bureau.",
      },
      201,
    );
  } catch (error) {
    await client.users.deleteUser(createdUser.id);
    throw error;
  }
}
