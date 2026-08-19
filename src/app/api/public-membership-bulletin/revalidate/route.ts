import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  buildMembershipBulletinRecord,
  type MembershipBulletinFormPayload,
  validateMembershipBulletinPayload,
} from "@/lib/membership-bulletin";
import { buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";
import { isBulletinRevalidationTokenActive } from "@/lib/bulletin-revalidation-email";
import { sendEmail } from "@/lib/mailer";
import { uploadBytesToS3 } from "@/lib/s3-upload";

function readToken(request: NextRequest): string {
  return request.nextUrl.searchParams.get("token")?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  const token = readToken(request);
  if (!token) return jsonError("Lien invalide.", 400);

  const data = await readClubData();
  const tokenEntry = data.bulletinRevalidationTokens.find((entry) => entry.token === token);
  if (!tokenEntry) return jsonError("Lien invalide.", 404);
  if (tokenEntry.usedAt) return jsonError("Ce lien a déjà été utilisé.", 410);
  if (!isBulletinRevalidationTokenActive(tokenEntry)) return jsonError("Lien expiré.", 410);

  const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
  if (!application) return jsonError("Dossier introuvable.", 404);

  return jsonOk({
    firstName: application.firstName,
    lastName: application.lastName,
    phone: application.phone,
    address: application.address,
    postalCode: application.postalCode,
    city: application.city,
    email: application.email,
    birthDate: application.membershipBulletin?.birthDate ?? "",
    emergencyContactName: application.membershipBulletin?.emergencyContactName ?? "",
    emergencyContactPhone: application.membershipBulletin?.emergencyContactPhone ?? "",
    selectedSlots: application.membershipBulletin?.selectedSlots ?? [],
    paymentPlan: application.membershipBulletin?.paymentPlan ?? "once",
    imageRights: application.membershipBulletin?.imageRights ?? "authorize",
    signedPlace: application.membershipBulletin?.signedPlace ?? "Sainte-Croix",
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as MembershipBulletinFormPayload & { token?: string };
  const token = payload.token?.trim() ?? "";
  if (!token) return jsonError("Lien invalide.", 400);

  const validation = validateMembershipBulletinPayload(payload, { requirePassword: false });
  if (!validation.ok) return jsonError(validation.message, 400);

  const data = await readClubData();
  const tokenEntry = data.bulletinRevalidationTokens.find((entry) => entry.token === token);
  if (!tokenEntry || tokenEntry.usedAt) return jsonError("Lien invalide ou déjà utilisé.", 400);
  if (!isBulletinRevalidationTokenActive(tokenEntry)) return jsonError("Lien expiré.", 400);

  const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
  if (!application) return jsonError("Dossier introuvable.", 404);

  const pdfBytes = await buildMembershipBulletinPdf(payload);
  const uploadedPdf = await uploadBytesToS3({
    body: pdfBytes,
    keyPrefix: "data/club-documents/bulletins",
    fileName: `bulletin-adhesion-${payload.lastName.trim().toLowerCase()}.pdf`,
    contentType: "application/pdf",
    userSegment: application.clerkUserId || application.id,
  });

  application.firstName = payload.firstName.trim();
  application.lastName = payload.lastName.trim();
  application.fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();
  application.phone = payload.phone.trim();
  application.address = payload.address.trim();
  application.postalCode = payload.postalCode.trim();
  application.city = payload.city.trim();
  application.email = payload.email.trim().toLowerCase();
  application.membershipBulletin = buildMembershipBulletinRecord(payload);
  application.documents.push(uploadedPdf);

  tokenEntry.usedAt = new Date().toISOString();
  await writeClubData(data);

  await sendEmail({
    to: application.email,
    subject: "[Activ'] Votre bulletin d'adhésion revalidé",
    text: "Bonjour,\n\nVotre bulletin d'adhésion a bien été revalidé.\nVous trouverez votre copie signée en pièce jointe.\n\nSportivement,\nL'équipe Activ'",
    html: "<p>Bonjour,</p><p>Votre bulletin d'adhésion a bien été revalidé.</p><p>Vous trouverez votre copie signée en pièce jointe.</p><p>Sportivement,<br/>L'équipe Activ'</p>",
    attachments: [
      {
        filename: uploadedPdf.name,
        content: pdfBytes,
        contentType: "application/pdf",
      },
    ],
  });

  return jsonOk({ message: "Bulletin revalidé avec succès." });
}
