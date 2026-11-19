import { NextRequest, NextResponse } from "next/server";
import { resolveBureauRecipient } from "@/lib/bureau-recipient";
import { escapeHtml, singleLine } from "@/lib/email-html";
import { cleanLine, cleanMultiline, isValidEmailAddress } from "@/lib/input-validation";
import { isMailConfigured, sendEmail } from "@/lib/mailer";
import { HOUR, MINUTE, limitByIp, limitByKey, readJsonBody } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const SUBJECT_LABELS: Record<string, string> = {
  trial: "Demande de séance d'essai",
  discipline: "Question sur une discipline",
  registration: "Inscription / pré-inscription",
  other: "Autre demande",
};

const UNAVAILABLE_MESSAGE =
  "Le formulaire de contact est momentanément indisponible. Réessayez plus tard ou écrivez directement à l'association.";

function reply(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const limited = limitByIp(request, "contact", { limit: 5, windowMs: 15 * MINUTE });
  if (limited) return limited;

  if (!isMailConfigured()) {
    console.error("contact : envoi d'e-mails non configuré");
    return reply(UNAVAILABLE_MESSAGE, 503);
  }

  const parsed = await readJsonBody(request, 20_000);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.body;

  // Champ piège invisible : les robots le remplissent, pas les visiteurs.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return reply("Message envoyé.", 201);
  }

  const firstName = cleanLine(payload.firstName, 61);
  const lastName = cleanLine(payload.lastName, 61);
  const email = cleanLine(payload.email, 255).toLowerCase();
  const phone = cleanLine(payload.phone, 31);
  const topic = cleanLine(payload.topic, 30) || "other";
  const disciplineName = cleanLine(payload.disciplineName, 121);
  const message = cleanMultiline(payload.message, 5001);

  if (!firstName || !lastName || !email || !message) {
    return reply("Merci de remplir tous les champs obligatoires.", 400);
  }
  if (firstName.length > 60 || lastName.length > 60 || phone.length > 30 || disciplineName.length > 120) {
    return reply("Un des champs saisis est trop long.", 400);
  }
  if (!isValidEmailAddress(email)) {
    return reply("Adresse e-mail invalide.", 400);
  }
  if (message.length < 10) {
    return reply("Le message doit contenir au moins 10 caractères.", 400);
  }
  if (message.length > 5000) {
    return reply("Le message est trop long.", 400);
  }

  const emailLimited = limitByKey("contact-email", email, { limit: 5, windowMs: HOUR });
  if (emailLimited) return emailLimited;

  const to = await resolveBureauRecipient();
  if (!to) {
    console.error("contact : aucune adresse de destination (CONTACT_TO, contact de l'association ou SMTP_USER)");
    return reply(UNAVAILABLE_MESSAGE, 503);
  }

  const topicLabel = SUBJECT_LABELS[topic] ?? SUBJECT_LABELS.other!;
  const fullName = `${firstName} ${lastName}`.trim();
  const mailSubject = singleLine(`[Contact Activ'] ${topicLabel} — ${fullName}`, 200);
  const showDiscipline = (topic === "discipline" || topic === "trial") && Boolean(disciplineName);

  const text = [
    `Nouveau message depuis le formulaire de contact.`,
    ``,
    `Nom : ${fullName}`,
    `E-mail : ${email}`,
    phone ? `Téléphone : ${phone}` : null,
    `Objet : ${topicLabel}`,
    showDiscipline ? `Discipline concernée : ${disciplineName}` : null,
    ``,
    `Message :`,
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <p><strong>Nouveau message</strong> depuis le formulaire de contact.</p>
    <ul>
      <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
      <li><strong>E-mail :</strong> ${escapeHtml(email)}</li>
      ${phone ? `<li><strong>Téléphone :</strong> ${escapeHtml(phone)}</li>` : ""}
      <li><strong>Objet :</strong> ${escapeHtml(topicLabel)}</li>
      ${showDiscipline ? `<li><strong>Discipline :</strong> ${escapeHtml(disciplineName)}</li>` : ""}
    </ul>
    <p><strong>Message :</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  const sendResult = await sendEmail({
    to,
    subject: mailSubject,
    text,
    html,
    replyTo: email,
  });

  if (!sendResult.sent) {
    console.error("contact : envoi impossible", sendResult.reason);
    return reply(
      "Votre message n'a pas pu être envoyé. Réessayez dans quelques minutes ou écrivez directement à l'association.",
      502,
    );
  }

  return reply("Votre message a bien été envoyé. Nous vous répondrons dès que possible.", 201);
}
