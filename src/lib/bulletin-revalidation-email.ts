import type { BulletinRevalidationToken } from "@/lib/club-data";
import { appBaseUrl } from "@/lib/app-url";
import { EMAIL_COLORS, emailButton, emailLayout, escapeHtml, safeHref, singleLine } from "@/lib/email-html";

export function buildBulletinRevalidationUrl(token: string): string {
  return `${appBaseUrl()}/preinscription?revalidateToken=${encodeURIComponent(token)}`;
}

export function buildBulletinRevalidationEmail(params: {
  secureLink: string;
  expiresAt: string;
  memberName?: string;
}) {
  const { secureLink, expiresAt } = params;
  const memberName = singleLine(params.memberName, 120);
  const greeting = memberName ? `Bonjour ${memberName},` : "Bonjour,";
  const expiryLabel = new Date(expiresAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  return {
    subject: "[Activ'] Merci de revalider votre bulletin d'adhésion",
    text: `${greeting}

Pour finaliser votre dossier, merci de revalider votre bulletin d'adhésion en ligne avec ce lien sécurisé :
${secureLink}

Ce lien expire le ${expiryLabel}.

Sportivement,
L'équipe Activ'`,
    html: emailLayout({
      title: "Merci de revalider votre bulletin",
      bodyHtml: `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 12px">Pour finaliser votre dossier, merci de <strong>revalider votre bulletin d'adhésion</strong> en ligne.</p>
${emailButton(secureLink, "Revalider mon bulletin")}
<p style="margin:0 0 12px">Ou copiez ce lien dans votre navigateur&nbsp;:<br/><a href="${safeHref(secureLink)}" style="color:${EMAIL_COLORS.blue};word-break:break-all">${escapeHtml(secureLink)}</a></p>
<p style="margin:0 0 12px;color:${EMAIL_COLORS.muted};font-size:14px">Ce lien expire le ${escapeHtml(expiryLabel)}.</p>
<p style="margin:16px 0 0">Sportivement,<br/>L'équipe Activ'</p>`,
    }),
  };
}

export function isBulletinRevalidationTokenActive(entry: BulletinRevalidationToken): boolean {
  return !entry.usedAt && new Date(entry.expiresAt).getTime() > Date.now();
}
