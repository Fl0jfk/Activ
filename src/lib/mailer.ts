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

/** Adresses en copie cachée par message (Gmail en accepte jusqu'à 100). */
const BCC_BATCH_SIZE = 40;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function addressOf(entry: unknown): string {
  if (typeof entry === "string") return entry.trim().toLowerCase();
  const address = (entry as { address?: string } | null)?.address;
  return address ? address.trim().toLowerCase() : "";
}

/**
 * Envoi groupé en copie cachée (CCI), par lots de 40 adresses.
 *
 * Un message par adhérent (~60 envois SMTP à la suite) dépassait la durée
 * maximale de la fonction serveur : l'envoi s'arrêtait en cours de route et
 * seule une partie des adhérents recevait le mail. En CCI, deux envois
 * suffisent et personne ne voit les adresses des autres.
 */
export async function sendEmailToMany(
  recipients: string[],
  params: {
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  },
): Promise<{ sent: number; failed: number; failures: EmailFailure[] }> {
  const unique = Array.from(
    new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)),
  );
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM;
  if (!transporter || !from) {
    return {
      sent: 0,
      failed: unique.length,
      failures: unique.map((email) => ({
        email,
        reason: "send_failed" as const,
        detail: "L'envoi d'e-mails n'est pas configuré sur le serveur.",
      })),
    };
  }

  let sent = 0;
  const failures: EmailFailure[] = [];

  for (const batch of chunk(unique, BCC_BATCH_SIZE)) {
    try {
      const info = await transporter.sendMail({
        from,
        // Message adressé à l'association, adhérents en copie cachée.
        to: from,
        bcc: batch,
        replyTo: params.replyTo ?? defaultReplyTo(),
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      const rejected = new Set(
        ((info.rejected ?? []) as unknown[]).map(addressOf).filter(Boolean),
      );
      for (const email of batch) {
        if (rejected.has(email)) {
          failures.push({
            email,
            reason: "invalid_address",
            detail: "Adresse refusée par le serveur de messagerie.",
          });
        } else {
          sent += 1;
        }
      }
    } catch (error) {
      console.error("sendEmailToMany: batch failed, retrying one by one", error);
      // Lot refusé en bloc : nouvel essai adresse par adresse pour isoler l'erreur.
      for (const email of batch) {
        const result = await sendEmail({ ...params, to: email });
        if (result.sent) {
          sent += 1;
        } else {
          failures.push({
            email,
            reason: result.reason === "smtp_not_configured" ? "send_failed" : result.reason,
            detail: result.detail,
          });
        }
      }
    }
  }

  return { sent, failed: failures.length, failures };
}
