import { NextRequest, NextResponse } from "next/server";
import { escapeHtml } from "@/lib/email-html";
import { isMailConfigured, sendEmail } from "@/lib/mailer";
import { readSiteData } from "@/lib/site-data";

const SUBJECT_LABELS: Record<string, string> = {
  trial: "Demande de séance d'essai",
  discipline: "Question sur une discipline",
  registration: "Inscription / pré-inscription",
  other: "Autre demande",
};

export async function POST(request: NextRequest) {
  if (!isMailConfigured()) {
    return NextResponse.json(
      {
        message:
          "L'envoi d'e-mails n'est pas encore configuré sur le serveur. Réessayez plus tard ou écrivez directement à l'association.",
      },
      { status: 503 },
    );
  }

  let payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    topic?: string;
    disciplineName?: string;
    message?: string;
    website?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "Corps de requête invalide." }, { status: 400 });
  }

  if (payload.website?.trim()) {
    return NextResponse.json({ message: "Message envoyé." }, { status: 201 });
  }

  const firstName = payload.firstName?.trim() ?? "";
  const lastName = payload.lastName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const phone = payload.phone?.trim() ?? "";
  const topic = payload.topic?.trim() ?? "other";
  const disciplineName = payload.disciplineName?.trim() ?? "";
  const message = payload.message?.trim() ?? "";

  if (!firstName || !lastName || !email || !message) {
    return NextResponse.json({ message: "Merci de remplir tous les champs obligatoires." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Adresse e-mail invalide." }, { status: 400 });
  }

  if (message.length < 10) {
    return NextResponse.json({ message: "Le message doit contenir au moins 10 caractères." }, { status: 400 });
  }

  if (message.length > 5000) {
    return NextResponse.json({ message: "Le message est trop long." }, { status: 400 });
  }

  const siteData = await readSiteData();
  const to = process.env.CONTACT_TO?.trim() || siteData.association.contactEmail;
  const topicLabel = SUBJECT_LABELS[topic] ?? SUBJECT_LABELS.other;
  const fullName = `${firstName} ${lastName}`.trim();
  const mailSubject = `[Contact Activ'] ${topicLabel} — ${fullName}`;

  const disciplineLine =
    topic === "discipline" || topic === "trial"
      ? disciplineName
        ? `Discipline concernée : ${disciplineName}\n`
        : ""
      : "";

  const text = [
    `Nouveau message depuis le formulaire de contact.`,
    ``,
    `Nom : ${fullName}`,
    `E-mail : ${email}`,
    phone ? `Téléphone : ${phone}` : null,
    `Objet : ${topicLabel}`,
    disciplineLine ? disciplineLine.trim() : null,
    ``,
    `Message :`,
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p><strong>Nouveau message</strong> depuis le formulaire de contact.</p>
    <ul>
      <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
      <li><strong>E-mail :</strong> ${escapeHtml(email)}</li>
      ${phone ? `<li><strong>Téléphone :</strong> ${escapeHtml(phone)}</li>` : ""}
      <li><strong>Objet :</strong> ${escapeHtml(topicLabel)}</li>
      ${disciplineName && (topic === "discipline" || topic === "trial") ? `<li><strong>Discipline :</strong> ${escapeHtml(disciplineName)}</li>` : ""}
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
    return NextResponse.json(
      {
        message:
          sendResult.reason === "send_failed"
            ? "L'envoi a échoué. Vérifiez la configuration Gmail (mot de passe d'application) ou réessayez."
            : "L'envoi d'e-mails n'est pas configuré.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { message: "Votre message a bien été envoyé. Nous vous répondrons dès que possible." },
    { status: 201 },
  );
}
