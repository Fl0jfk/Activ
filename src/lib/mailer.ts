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

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
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
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { sent: true as const };
  } catch (error) {
    console.error("sendEmail failed", error);
    return { sent: false as const, reason: "send_failed" as const };
  }
}
