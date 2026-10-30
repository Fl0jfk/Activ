import { NextRequest, after } from "next/server";
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
  validateMembershipBulletinPayload,
  type MembershipBulletinFormPayload,
} from "@/lib/membership-bulletin";
import { buildMembershipActivityCatalog, resolveMembershipDisciplineIds } from "@/lib/membership-activities";
import { buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";
import { sendEmail } from "@/lib/mailer";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { readSiteData } from "@/lib/site-data";
import { uploadBytesToS3 } from "@/lib/s3-upload";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";
import {
  consumeVerifiedEmailCode,
  findVerifiedEmailCode,
} from "@/lib/email-verification";

/** PDF + S3 + Clerk : laisser assez de temps, e-mails hors chemin critique. */
export const maxDuration = 60;

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
      emailVerificationId?: string;
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

const ALREADY_RECEIVED_MESSAGE =
  "Votre bulletin d'adhésion a déjà bien été reçu. Le bureau va le traiter, vous recevrez une confirmation par e-mail. Vous n'avez pas besoin de le renvoyer.";

async function handleBulletinSubmission(
  payload: MembershipBulletinFormPayload & {
    bulletinMode?: boolean;
    emailVerificationId?: string;
  },
) {
  const siteData = await readSiteData();
  const activityOptions = buildMembershipActivityCatalog(siteData);
  const validation = validateMembershipBulletinPayload(payload, {
    requirePassword: true,
    activityOptions,
  });
  if (!validation.ok) {
    return jsonError(validation.message, 400);
  }

  const email = payload.email.trim().toLowerCase();
  const data = await readClubData();
  const existingApplication = data.applications.find(
    (entry) =>
      entry.email.trim().toLowerCase() === email &&
      entry.status !== "rejected" &&
      entry.status !== "cancelled",
  );
  if (existingApplication) {
    return jsonOk({ message: ALREADY_RECEIVED_MESSAGE, alreadyReceived: true });
  }

  const emailVerification = findVerifiedEmailCode(
    data,
    email,
    payload.emailVerificationId,
  );
  if (!emailVerification) {
    return jsonError(
      "Confirmez votre adresse e-mail avec le code reçu avant d'envoyer votre bulletin.",
      400,
      "email_not_verified",
    );
  }

  const activeDisciplines = getActiveDisciplineOptions(siteData);
  const disciplineIds = resolveMembershipDisciplineIds(payload.selectedSlots, activityOptions);
  const disciplineId =
    disciplineIds[0] ?? (activeDisciplines.length === 1 ? activeDisciplines[0].id : null);
  if (!disciplineId) {
    return jsonError(
      "Impossible de rattacher cette activité à une discipline du site. Contactez le bureau de l'association.",
      400,
    );
  }
  const allDisciplineIds = [
    disciplineId,
    ...disciplineIds.filter((id) => id !== disciplineId),
  ];

  const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
    disciplineIds: allDisciplineIds,
    espaceValidated: false,
    membershipStatus: "pending",
    registrationState: "pending",
  });

  const client = await clerkClient();
  let createdUser: { id: string } | undefined;
  try {
    createdUser = await client.users.createUser({
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      emailAddress: [email],
      password: payload.password,
      privateMetadata,
      publicMetadata,
    });
  } catch (error) {
    const parsedError = parseClerkError(error);
    if (parsedError.status === 409) {
      const latestData = await readClubData();
      const alreadyRegistered = latestData.applications.some(
        (entry) =>
          entry.email.trim().toLowerCase() === email &&
          entry.status !== "rejected" &&
          entry.status !== "cancelled",
      );
      if (alreadyRegistered) {
        return jsonOk({ message: ALREADY_RECEIVED_MESSAGE, alreadyReceived: true });
      }
      console.error("Bulletin blocked: Clerk account already exists", { email });
      return jsonError(
        "Un compte existe déjà avec cette adresse e-mail. Connectez-vous à votre espace membre, ou utilisez « Mot de passe oublié ». Si le problème persiste, contactez le bureau.",
        409,
        "existing_account",
      );
    }
    console.error("Bulletin blocked: Clerk user creation failed", { email, error });
    return jsonError(parsedError.message, parsedError.status, "clerk_error");
  }

  if (!createdUser) {
    return jsonError("Erreur serveur pendant la création du compte.", 500);
  }

  try {
    const pdfBytes = await buildMembershipBulletinPdf(payload, { activityOptions });
    const uploadedPdf = await uploadBytesToS3({
      body: pdfBytes,
      keyPrefix: "data/club-documents/bulletins",
      fileName: `bulletin-adhesion-${payload.lastName.trim().toLowerCase()}.pdf`,
      contentType: "application/pdf",
      userSegment: createdUser.id,
    });

    const membershipBulletin = buildMembershipBulletinRecord(payload, { activityOptions });
    const application = buildRegistrationApplication({
      disciplineId,
      disciplineIds: allDisciplineIds,
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
      emailVerifiedAt: consumeVerifiedEmailCode(emailVerification),
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

    // E-mails après la réponse JSON pour éviter timeouts / corps vide (Safari).
    after(async () => {
      await notifyBureauNewPreinscription({
        application,
        trialSlots: data.trialSlots,
        pdfAttachment: {
          filename: uploadedPdf.name,
          content: pdfBytes,
        },
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
  emailVerificationId?: string;
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

  const emailVerification = findVerifiedEmailCode(
    data,
    payload.email.trim().toLowerCase(),
    payload.emailVerificationId,
  );
  if (!emailVerification) {
    return jsonError(
      "Confirmez votre adresse e-mail avec le code reçu avant d'envoyer votre demande.",
      400,
      "email_not_verified",
    );
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
      emailVerifiedAt: consumeVerifiedEmailCode(emailVerification),
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
