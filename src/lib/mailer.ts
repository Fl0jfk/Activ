import nodemailer from "nodemailer";

/** Gmail : SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER + mot de passe d'application. */
export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM,
  );
}

function createTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function defaultReplyTo(): string | undefined {
  return process.env.SMTP_USER?.trim() || undefined;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: {
    filename: string;
    content: Buffer | Uint8Array;
    contentType?: string;
  }[];
}) {
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM;
  if (!transporter || !from) {
    return { sent: false as const, reason: "smtp_not_configured" as const };
  }

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      replyTo: params.replyTo ?? defaultReplyTo(),
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content),
        contentType: attachment.contentType,
      })),
    });
    return { sent: true as const };
  } catch (error) {
    console.error("sendEmail failed", error);
    return { sent: false as const, reason: "send_failed" as const };
  }
}

/** Envoi individuel à chaque destinataire (équivalent CCI : pas de liste visible). */
export async function sendEmailToMany(
  recipients: string[],
  params: {
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  },
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const result = await sendEmail({ ...params, to });
    if (result.sent) {
      sent += 1;
    } else {
      failed += 1;
    }
  }
  return { sent, failed };
}
