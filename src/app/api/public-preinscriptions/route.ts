import { NextRequest, NextResponse, after } from "next/server";
import { appBaseUrl } from "@/lib/app-url";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import {
  cleanLine,
  cleanMultiline,
  isValidEmailAddress,
  isValidFrenchPostalCode,
  normalizePhoneNumber,
  validatePasswordRules,
} from "@/lib/input-validation";
import { sendEmail } from "@/lib/mailer";
import {
  buildMembershipActivityCatalog,
  resolveMembershipDisciplineIds,
} from "@/lib/membership-activities";
import {
  BULLETIN_LIMITS,
  buildMembershipBulletinRecord,
  validateMembershipBulletinPayload,
} from "@/lib/membership-bulletin";
import { BulletinPdfError, buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";
import { notifyBureauNewPreinscription } from "@/lib/preinscription-notify";
import {
  REGISTRATION_SERVER_ERROR_MESSAGE,
  RegistrationFailure,
  checkVerificationAndDuplicate,
  describeErrorForLog,
  registerApplicant,
  type RegistrationOutcome,
} from "@/lib/public-registration";
import { buildApplicantAcknowledgmentEmail } from "@/lib/registration-emails";
import { MINUTE, apiError, apiOk, limitByIp, limitByKey, readJsonBody } from "@/lib/request-guard";
import { uploadBytesToS3 } from "@/lib/s3-upload";
import { inspectSignatureDataUrl } from "@/lib/signature-image";
import { readSiteData } from "@/lib/site-data";
import { slugify } from "@/lib/slug";
import { formatTrialSlotDate } from "@/lib/trial-slots";

export const dynamic = "force-dynamic";
/** PDF + stockage + Clerk : laisser assez de temps ; les e-mails partent après la réponse. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 1_500_000;

const BULLETIN_RECEIVED =
  "Votre bulletin d'adhésion est bien enregistré et votre compte est créé. Le bureau va examiner votre dossier : vous recevrez un e-mail dès que votre espace adhérent sera activé.";
const BULLETIN_ALREADY_RECEIVED =
  "Votre bulletin d'adhésion a déjà bien été reçu. Le bureau va le traiter et vous recevrez un e-mail dès que votre espace adhérent sera activé. Vous n'avez pas besoin de le renvoyer.";
const TRIAL_RECEIVED =
  "Votre demande de séance d'essai est bien enregistrée et votre compte est créé. Le bureau va l'examiner : vous recevrez un e-mail dès que votre espace adhérent sera activé.";
const TRIAL_ALREADY_RECEIVED =
  "Votre demande a déjà bien été reçue. Le bureau va la traiter et vous recevrez un e-mail dès que votre espace adhérent sera activé. Vous n'avez pas besoin de la renvoyer.";

type Mode = "bulletin" | "trial";

export async function POST(request: NextRequest) {
  const limited = limitByIp(request, "preinscriptions", { limit: 15, windowMs: 15 * MINUTE });
  if (limited) return limited;

  const parsed = await readJsonBody(request, MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.response;

  try {
    return parsed.body.bulletinMode === true
      ? await handleBulletinSubmission(parsed.body)
      : await handleTrialSubmission(parsed.body);
  } catch (error) {
    console.error("Inscription publique impossible", describeErrorForLog(error));
    return apiError(REGISTRATION_SERVER_ERROR_MESSAGE, 500, { code: "server_error" });
  }
}

function respondToOutcome(
  outcome: Exclude<RegistrationOutcome, { kind: "created" }>,
  mode: Mode,
): NextResponse {
  if (outcome.kind === "already_received") {
    return apiOk({
      ok: true,
      alreadyReceived: true,
      message: mode === "bulletin" ? BULLETIN_ALREADY_RECEIVED : TRIAL_ALREADY_RECEIVED,
    });
  }
  const { failure } = outcome;
  return apiError(failure.message, failure.status, { code: failure.code, fieldErrors: failure.fieldErrors });
}

/**
 * Première étape commune : adresse bien formée, confirmée par code, puis doublon.
 * La preuve de propriété de l'adresse passe avant toute réponse « déjà reçu » : aucune énumération possible.
 */
async function checkIdentity(
  body: Record<string, unknown>,
  mode: Mode,
): Promise<{ email: string; verificationId: string } | NextResponse> {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmailAddress(email)) {
    return apiError("Adresse e-mail invalide.", 400, {
      code: "validation",
      fieldErrors: { email: "Adresse e-mail invalide." },
    });
  }
  const emailLimited = limitByKey("preinscriptions-email", email, { limit: 12, windowMs: 15 * MINUTE });
  if (emailLimited) return emailLimited;

  const verificationId = typeof body.emailVerificationId === "string" ? body.emailVerificationId : "";
  const early = await checkVerificationAndDuplicate(email, verificationId);
  if (early) return respondToOutcome(early, mode);
  return { email, verificationId };
}

async function handleBulletinSubmission(body: Record<string, unknown>): Promise<NextResponse> {
  const identity = await checkIdentity(body, "bulletin");
  if (identity instanceof NextResponse) return identity;

  const siteData = await readSiteData();
  const activityOptions = buildMembershipActivityCatalog(siteData);
  const validation = validateMembershipBulletinPayload(body, { requirePassword: true, activityOptions });
  if (!validation.ok) {
    return apiError(validation.message, 400, { code: "validation", fieldErrors: validation.fieldErrors });
  }
  const payload = validation.payload;

  const signature = inspectSignatureDataUrl(payload.signatureDataUrl);
  if (!signature.ok) {
    return apiError(signature.message, 400, {
      code: "validation",
      fieldErrors: { signature: signature.message },
    });
  }

  const activeDisciplines = getActiveDisciplineOptions(siteData);
  const disciplineIds = resolveMembershipDisciplineIds(payload.selectedSlots, activityOptions);
  const disciplineId = disciplineIds[0] ?? (activeDisciplines.length === 1 ? activeDisciplines[0]!.id : null);
  if (!disciplineId) {
    const message =
      "Impossible de rattacher cette activité à une discipline du site. Contactez le bureau de l'association.";
    return apiError(message, 400, { code: "validation", fieldErrors: { selectedSlots: message } });
  }
  const allDisciplineIds = [disciplineId, ...disciplineIds.filter((id) => id !== disciplineId)];

  const result = await registerApplicant(
    {
      email: identity.email,
      verificationId: identity.verificationId,
      password: payload.password ?? "",
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      address: payload.address,
      postalCode: payload.postalCode,
      city: payload.city,
      disciplineId,
      disciplineIds: allDisciplineIds,
      trialSlotId: null,
      motivation: "",
    },
    async (applicationId) => {
      const membershipBulletin = buildMembershipBulletinRecord(payload, { activityOptions });
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await buildMembershipBulletinPdf(payload, { activityOptions });
      } catch (error) {
        if (error instanceof BulletinPdfError) {
          throw new RegistrationFailure(error.message, 400, "validation", { signature: error.message });
        }
        throw error;
      }
      const uploadedPdf = await uploadBytesToS3({
        body: pdfBytes,
        keyPrefix: "data/club-documents/bulletins",
        fileName: `bulletin-adhesion-${slugify(payload.lastName) || "adherent"}.pdf`,
        contentType: "application/pdf",
        userSegment: applicationId,
      });
      return {
        documents: [uploadedPdf],
        membershipBulletin,
        artifacts: { pdfBytes, pdfName: uploadedPdf.name },
      };
    },
  );

  if (result.kind !== "created") return respondToOutcome(result, "bulletin");

  const { application, trialSlots, artifacts } = result;
  const bulletin = application.membershipBulletin;
  const contactEmail = siteData.association.contactEmail?.trim() ?? "";
  after(async () => {
    await notifyBureauNewPreinscription({
      application,
      trialSlots,
      pdfAttachment: { filename: artifacts.pdfName, content: artifacts.pdfBytes },
    });
    try {
      const content = buildApplicantAcknowledgmentEmail({
        firstName: application.firstName,
        activityLabels: bulletin?.selectedActivityLabels ?? [],
        payment: bulletin
          ? {
              activitiesTotal: bulletin.activitiesTotal,
              grandTotal: bulletin.grandTotal,
              plan: bulletin.paymentPlan,
            }
          : undefined,
        hasPdfCopy: true,
        signInUrl: `${appBaseUrl()}/sign-in`,
        contactEmail,
      });
      const sent = await sendEmail({
        to: application.email,
        ...content,
        attachments: [
          { filename: artifacts.pdfName, content: artifacts.pdfBytes, contentType: "application/pdf" },
        ],
      });
      if (!sent.sent) console.error("Accusé de réception du bulletin non envoyé", sent.reason);
    } catch (error) {
      console.error("Accusé de réception du bulletin en erreur", error);
    }
  });

  return apiOk({ ok: true, message: BULLETIN_RECEIVED });
}

async function handleTrialSubmission(body: Record<string, unknown>): Promise<NextResponse> {
  const identity = await checkIdentity(body, "trial");
  if (identity instanceof NextResponse) return identity;

  const siteData = await readSiteData();
  const errors: Record<string, string> = {};

  const firstName = cleanLine(body.firstName, BULLETIN_LIMITS.name + 1);
  if (!firstName) errors.firstName = "Indiquez votre prénom.";
  else if (firstName.length > BULLETIN_LIMITS.name) errors.firstName = "Prénom trop long.";

  const lastName = cleanLine(body.lastName, BULLETIN_LIMITS.name + 1);
  if (!lastName) errors.lastName = "Indiquez votre nom.";
  else if (lastName.length > BULLETIN_LIMITS.name) errors.lastName = "Nom trop long.";

  const phone = normalizePhoneNumber(body.phone);
  if (!phone) errors.phone = "Numéro de téléphone invalide (exemple : 06 12 34 56 78).";

  const address = cleanLine(body.address, BULLETIN_LIMITS.address + 1);
  if (!address) errors.address = "Indiquez votre adresse.";
  else if (address.length > BULLETIN_LIMITS.address) errors.address = "Adresse trop longue.";

  const postalCode = typeof body.postalCode === "string" ? body.postalCode.trim() : "";
  if (!isValidFrenchPostalCode(postalCode)) errors.postalCode = "Code postal invalide (5 chiffres).";

  const city = cleanLine(body.city, BULLETIN_LIMITS.city + 1);
  if (!city) errors.city = "Indiquez votre ville.";
  else if (city.length > BULLETIN_LIMITS.city) errors.city = "Nom de ville trop long.";

  const passwordCheck = validatePasswordRules(body.password);
  if (!passwordCheck.ok) errors.password = passwordCheck.message;

  const motivation = cleanMultiline(body.motivation, 1001);
  if (motivation.length > 1000) errors.motivation = "Votre message est trop long (1 000 caractères maximum).";

  const disciplineId = typeof body.disciplineId === "string" ? body.disciplineId : "";
  const discipline = siteData.disciplines.find(
    (entry) => entry.id === disciplineId && entry.active && entry.allowTrialRequest,
  );
  if (!discipline) errors.disciplineId = "Cette discipline ne propose pas de séance d'essai.";

  const trialSlotId = typeof body.trialSlotId === "string" ? body.trialSlotId.trim() : "";
  if (!trialSlotId) errors.trialSlotId = "Choisissez un créneau d'essai.";

  if (Object.keys(errors).length > 0 || !discipline) {
    const messages = Object.values(errors);
    return apiError(
      messages.length === 1 ? messages[0]! : "Certaines informations sont manquantes ou invalides. Vérifiez les champs signalés.",
      400,
      { code: "validation", fieldErrors: errors },
    );
  }

  const result = await registerApplicant(
    {
      email: identity.email,
      verificationId: identity.verificationId,
      password: body.password as string,
      firstName,
      lastName,
      phone: phone!,
      address,
      postalCode,
      city,
      disciplineId: discipline.id,
      disciplineIds: [discipline.id],
      trialSlotId,
      motivation,
    },
    async () => ({ documents: [], membershipBulletin: null, artifacts: null }),
  );

  if (result.kind !== "created") return respondToOutcome(result, "trial");

  const { application, trialSlots } = result;
  const slot = trialSlots.find((entry) => entry.id === application.trialSlotId);
  const contactEmail = siteData.association.contactEmail?.trim() ?? "";
  after(async () => {
    await notifyBureauNewPreinscription({ application, trialSlots });
    try {
      const content = buildApplicantAcknowledgmentEmail({
        firstName: application.firstName,
        activityLabels: [discipline.name],
        trial: slot ? { title: slot.title, whenLabel: formatTrialSlotDate(slot.startsAt) } : undefined,
        hasPdfCopy: false,
        signInUrl: `${appBaseUrl()}/sign-in`,
        contactEmail,
      });
      const sent = await sendEmail({ to: application.email, ...content });
      if (!sent.sent) console.error("Accusé de réception de la demande d'essai non envoyé", sent.reason);
    } catch (error) {
      console.error("Accusé de réception de la demande d'essai en erreur", error);
    }
  });

  return apiOk({ ok: true, message: TRIAL_RECEIVED });
}
