import type { DocumentRequestToken } from "@/lib/club-data";
import { appBaseUrl } from "@/lib/app-url";
import { EMAIL_COLORS, emailButton, emailLayout, escapeHtml, safeHref, singleLine } from "@/lib/email-html";

export function buildDocumentUploadUrl(token: string): string {
  return `${appBaseUrl()}/piece-jointe?token=${encodeURIComponent(token)}`;
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

export function buildDocumentRequestEmail(params: {
  documentLabel: string;
  secureLink: string;
  expiresAt: string;
  memberName?: string;
}) {
  const { secureLink, expiresAt } = params;
  const documentLabel = singleLine(params.documentLabel, 200);
  const memberName = singleLine(params.memberName, 120);
  const greeting = memberName ? `Bonjour ${memberName},` : "Bonjour,";
  const expiryLabel = formatExpiry(expiresAt);

  const subject = `[Activ'] Pièce à fournir : ${documentLabel}`;
  const text = `${greeting}

Le bureau de l'association vous demande de déposer la pièce suivante : ${documentLabel}.

Utilisez ce lien sécurisé pour envoyer votre document (sans vous connecter) :
${secureLink}

Ce lien expire le ${expiryLabel}.

Sportivement,
L'équipe Activ'`;

  const html = emailLayout({
    title: "Une pièce est à fournir",
    bodyHtml: `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 12px">Le bureau de l'association vous demande de déposer la pièce suivante&nbsp;: <strong>${escapeHtml(documentLabel)}</strong>.</p>
${emailButton(secureLink, "Déposer ma pièce")}
<p style="margin:0 0 12px">Ou copiez ce lien dans votre navigateur&nbsp;:<br/><a href="${safeHref(secureLink)}" style="color:${EMAIL_COLORS.blue};word-break:break-all">${escapeHtml(secureLink)}</a></p>
<p style="margin:0 0 12px;color:${EMAIL_COLORS.muted};font-size:14px">Ce lien expire le ${escapeHtml(expiryLabel)}.</p>
<p style="margin:16px 0 0">Sportivement,<br/>L'équipe Activ'</p>`,
  });

  return { subject, text, html };
}

export function buildDocumentReceivedBureauEmail(params: {
  memberName: string;
  memberEmail: string;
  documentLabel: string;
  fileName: string;
}) {
  const memberName = singleLine(params.memberName, 120);
  const memberEmail = singleLine(params.memberEmail, 200);
  const documentLabel = singleLine(params.documentLabel, 200);
  const fileName = singleLine(params.fileName, 200);
  const subject = `[Activ'] Pièce reçue — ${memberName}`;
  const text = `${memberName} (${memberEmail}) a déposé la pièce demandée « ${documentLabel} » via le lien sécurisé.

Fichier : ${fileName}

Consultez le dossier dans l'espace bureau.`;
  const html = emailLayout({
    title: "Une pièce a été déposée",
    bodyHtml: `<p style="margin:0 0 12px"><strong>${escapeHtml(memberName)}</strong> (${escapeHtml(memberEmail)}) a déposé la pièce demandée «&nbsp;<strong>${escapeHtml(documentLabel)}</strong>&nbsp;» via le lien sécurisé.</p>
<p style="margin:0 0 12px">Fichier&nbsp;: ${escapeHtml(fileName)}</p>
<p style="margin:0">Consultez le dossier dans l'espace bureau.</p>`,
  });
  return { subject, text, html };
}

export function isTokenActive(entry: DocumentRequestToken): boolean {
  return !entry.usedAt && new Date(entry.expiresAt).getTime() > Date.now();
}
