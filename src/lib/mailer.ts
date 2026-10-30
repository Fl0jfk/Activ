import nodemailer, { type Transporter } from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";

/** Gmail : SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER + mot de passe d'application. */
export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM,
  );
}

let cachedTransporter: Transporter | null = null;
let cachedSignature = "";

function createTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const signature = `${host}:${port}:${user}`;
  if (cachedTransporter && cachedSignature === signature) {
    return cachedTransporter;
  }

  const options: SMTPPool.Options = {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Réutilise la connexion SMTP : un envoi groupé de 60 messages ne
    // rouvre pas 60 sessions (plus rapide et moins suspect pour les filtres).
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    socketTimeout: 60_000,
  };
  const transporter = nodemailer.createTransport(options);
  cachedTransporter = transporter;
  cachedSignature = signature;
  return transporter;
}

function defaultReplyTo(): string | undefined {
  return process.env.SMTP_USER?.trim() || undefined;
}

export type EmailFailureReason = "invalid_address" | "mailbox_unavailable" | "send_failed";

export type EmailFailure = {
  email: string;
  reason: EmailFailureReason;
  /** Message lisible renvoyé par le serveur de messagerie. */
  detail: string;
};

type SendEmailFailure = {
  sent: false;
  reason: "smtp_not_configured" | EmailFailureReason;
  detail: string;
};

function describeMailError(error: unknown): {
  reason: EmailFailureReason;
  detail: string;
} {
  const candidate = error as {
    responseCode?: number;
    response?: string;
    code?: string;
    message?: string;
  } | null;
  const code =
    typeof candidate?.responseCode === "number" ? candidate.responseCode : null;
  const response = candidate?.response?.trim() || "";
  const fallback = candidate?.message?.trim() || "";

  // 550 / 551 / 553 : adresse inexistante ou boîte indisponible (rejet définitif).
  if (code === 550 || code === 551 || code === 553) {
    return {
      reason: "mailbox_unavailable",
      detail: response || "Adresse introuvable ou boîte de réception indisponible.",
    };
  }

  if (candidate?.code === "EENVELOPE") {
    return {
      reason: "invalid_address",
      detail: response || fallback || "Adresse e-mail refusée.",
    };
  }

  return {
    reason: "send_failed",
    detail: response || fallback || "Erreur d'envoi.",
  };
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
}): Promise<{ sent: true } | SendEmailFailure> {
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM;
  if (!transporter || !from) {
    return {
      sent: false as const,
      reason: "smtp_not_configured" as const,
      detail: "L'envoi d'e-mails n'est pas configuré sur le serveur.",
    };
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
    return { sent: false as const, ...describeMailError(error) };
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
): Promise<{ sent: number; failed: number; failures: EmailFailure[] }> {
  let sent = 0;
  const failures: EmailFailure[] = [];
  for (const [index, to] of recipients.entries()) {
    if (index > 0) {
      // Petit délai : évite les rafales qui déclenchent les filtres anti-spam.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const result = await sendEmail({ ...params, to });
    if (result.sent) {
      sent += 1;
    } else {
      failures.push({
        email: to,
        reason: result.reason === "smtp_not_configured" ? "send_failed" : result.reason,
        detail: result.detail,
      });
    }
  }
  return { sent, failed: failures.length, failures };
}
