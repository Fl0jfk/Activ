import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
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
}) {
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM;
  if (!transporter || !from) {
    return { sent: false as const };
  }

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  return { sent: true as const };
}
