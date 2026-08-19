import type { DocumentRequestToken } from "@/lib/club-data";

export function buildDocumentUploadUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/piece-jointe?token=${encodeURIComponent(token)}`;
}

export function buildDocumentRequestEmail(params: {
  documentLabel: string;
  secureLink: string;
  expiresAt: string;
  memberName?: string;
}) {
  const { documentLabel, secureLink, expiresAt, memberName } = params;
  const greeting = memberName?.trim() ? `Bonjour ${memberName.trim()},` : "Bonjour,";
  const expiryLabel = new Date(expiresAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subject = `[Activ'] Pièce à fournir : ${documentLabel}`;
  const text = `${greeting}

Le bureau de l'association vous demande de déposer la pièce suivante : ${documentLabel}.

Utilisez ce lien sécurisé pour envoyer votre document (sans vous connecter) :
${secureLink}

Ce lien expire le ${expiryLabel}.

Sportivement,
L'équipe Activ'`;

  const html = `<p>${greeting}</p>
<p>Le bureau de l'association vous demande de déposer la pièce suivante&nbsp;: <strong>${documentLabel}</strong>.</p>
<p><a href="${secureLink}" style="display:inline-block;margin:12px 0;padding:12px 18px;background:#0e7490;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Déposer ma pièce</a></p>
<p>Ou copiez ce lien dans votre navigateur&nbsp;:<br/><a href="${secureLink}">${secureLink}</a></p>
<p style="color:#64748b;font-size:14px">Ce lien expire le ${expiryLabel}.</p>
<p>Sportivement,<br/>L'équipe Activ'</p>`;

  return { subject, text, html };
}

export function buildDocumentReceivedBureauEmail(params: {
  memberName: string;
  memberEmail: string;
  documentLabel: string;
  fileName: string;
}) {
  const { memberName, memberEmail, documentLabel, fileName } = params;
  const subject = `[Activ'] Pièce reçue — ${memberName}`;
  const text = `${memberName} (${memberEmail}) a déposé la pièce demandée « ${documentLabel} » via le lien public.

Fichier : ${fileName}

Consultez le dossier dans le cockpit bureau.`;
  const html = `<p><strong>${memberName}</strong> (${memberEmail}) a déposé la pièce demandée « <strong>${documentLabel}</strong> » via le lien public.</p>
<p>Fichier&nbsp;: ${fileName}</p>
<p>Consultez le dossier dans le cockpit bureau.</p>`;
  return { subject, text, html };
}

export function isTokenActive(entry: DocumentRequestToken): boolean {
  return !entry.usedAt && new Date(entry.expiresAt).getTime() > Date.now();
}
