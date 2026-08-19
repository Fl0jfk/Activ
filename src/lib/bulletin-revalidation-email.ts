import type { BulletinRevalidationToken } from "@/lib/club-data";

export function buildBulletinRevalidationUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/preinscription?revalidateToken=${encodeURIComponent(token)}`;
}

export function buildBulletinRevalidationEmail(params: {
  secureLink: string;
  expiresAt: string;
  memberName?: string;
}) {
  const { secureLink, expiresAt, memberName } = params;
  const greeting = memberName?.trim() ? `Bonjour ${memberName.trim()},` : "Bonjour,";
  const expiryLabel = new Date(expiresAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    subject: "[Activ'] Merci de revalider votre bulletin d'adhésion",
    text: `${greeting}

Pour finaliser votre dossier, merci de revalider votre bulletin d'adhésion en ligne avec ce lien sécurisé :
${secureLink}

Ce lien expire le ${expiryLabel}.

Sportivement,
L'équipe Activ'`,
    html: `<p>${greeting}</p>
<p>Pour finaliser votre dossier, merci de <strong>revalider votre bulletin d'adhésion</strong> en ligne.</p>
<p><a href="${secureLink}" style="display:inline-block;margin:12px 0;padding:12px 18px;background:#0e7490;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Revalider mon bulletin</a></p>
<p>Ou copiez ce lien dans votre navigateur&nbsp;:<br/><a href="${secureLink}">${secureLink}</a></p>
<p style="color:#64748b;font-size:14px">Ce lien expire le ${expiryLabel}.</p>
<p>Sportivement,<br/>L'équipe Activ'</p>`,
  };
}

export function isBulletinRevalidationTokenActive(entry: BulletinRevalidationToken): boolean {
  return !entry.usedAt && new Date(entry.expiresAt).getTime() > Date.now();
}
