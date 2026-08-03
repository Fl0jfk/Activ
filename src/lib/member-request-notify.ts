import type { MemberRequest } from "@/lib/club-data";
import { escapeHtml } from "@/lib/email-html";
import { sendEmail } from "@/lib/mailer";

function bureauNotifyEmail(): string | null {
  const smtpUser = process.env.SMTP_USER?.trim();
  return smtpUser || null;
}

export async function notifyBureauNewMemberRequest(request: MemberRequest): Promise<void> {
  try {
    const to = bureauNotifyEmail();
    if (!to) {
      console.warn("notifyBureauNewMemberRequest skipped: SMTP_USER missing");
      return;
    }

    const subject = `[Activ'] Nouvelle demande membre — ${request.subject}`;
    const text = [
      "Nouvelle demande reçue depuis l'espace membre.",
      "",
      `Membre : ${request.memberName}`,
      `E-mail : ${request.memberEmail}`,
      `Objet : ${request.subject}`,
      `Message : ${request.message}`,
      `Pièce jointe : ${request.attachment ? request.attachment.name : "Aucune"}`,
      "",
      "Connectez-vous au cockpit bureau pour la traiter.",
    ].join("\n");

    const html = `
      <p><strong>Nouvelle demande membre</strong> reçue depuis l'espace personnel.</p>
      <ul>
        <li><strong>Membre :</strong> ${escapeHtml(request.memberName)}</li>
        <li><strong>E-mail :</strong> ${escapeHtml(request.memberEmail)}</li>
        <li><strong>Objet :</strong> ${escapeHtml(request.subject)}</li>
        <li><strong>Message :</strong> ${escapeHtml(request.message)}</li>
        <li><strong>Pièce jointe :</strong> ${
          request.attachment ? escapeHtml(request.attachment.name) : "Aucune"
        }</li>
      </ul>
      <p>Connectez-vous au cockpit bureau pour la traiter.</p>
    `;

    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      replyTo: request.memberEmail,
    });

    if (!result.sent) {
      console.error("notifyBureauNewMemberRequest failed", result.reason);
    }
  } catch (error) {
    console.error("notifyBureauNewMemberRequest unexpected error", error);
  }
}

export async function notifyMemberRequestTreated(request: MemberRequest): Promise<void> {
  try {
    const to = request.memberEmail?.trim();
    if (!to) return;

    const subject = `[Activ'] Votre demande a été traitée — ${request.subject}`;
    const reply = request.bureauReply?.trim() || "Votre demande a été traitée par le bureau.";
    const text = [
      "Bonjour,",
      "",
      `Votre demande « ${request.subject} » a été traitée.`,
      "",
      `Réponse du bureau :`,
      reply,
      request.bureauAttachment ? `Pièce jointe : ${request.bureauAttachment.name}` : null,
      "",
      "Sportivement,",
      "L'équipe Activ'",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <p>Bonjour,</p>
      <p>Votre demande <strong>${escapeHtml(request.subject)}</strong> a été traitée.</p>
      <p><strong>Réponse du bureau :</strong></p>
      <p>${escapeHtml(reply)}</p>
      ${
        request.bureauAttachment
          ? `<p>Une pièce jointe a été ajoutée : <strong>${escapeHtml(request.bureauAttachment.name)}</strong>. Consultez-la dans votre espace membre.</p>`
          : ""
      }
      <p>Sportivement,<br/>L'équipe Activ'</p>
    `;

    const result = await sendEmail({ to, subject, text, html });
    if (!result.sent) {
      console.error("notifyMemberRequestTreated failed", result.reason);
    }
  } catch (error) {
    console.error("notifyMemberRequestTreated unexpected error", error);
  }
}
