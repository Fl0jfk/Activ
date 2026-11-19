export const EMAIL_COLORS = {
  blue: "#1f6fd0",
  blueDark: "#14407f",
  green: "#2e9e4f",
  greenDark: "#17653a",
  cream: "#fbf8f3",
  line: "#e8e2d8",
  text: "#1e293b",
  muted: "#64748b",
} as const;

/** Échappe une valeur avant de l'insérer dans du HTML (contenu ou attribut). */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Valeur sur une seule ligne, pour les objets d'e-mail et les noms de fichiers (pas de retour à la ligne injecté). */
export function singleLine(value: string | null | undefined, maxLength = 200): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Lien http(s) échappé pour un attribut href ; « # » si l'adresse n'est pas sûre. */
export function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";
}

export function emailButton(href: string, label: string, color: string = EMAIL_COLORS.blue): string {
  return `<p style="margin:20px 0"><a href="${safeHref(href)}" style="display:inline-block;padding:12px 22px;background:${color};color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px">${escapeHtml(label)}</a></p>`;
}

/** Cadre commun des e-mails : en-tête bleu, fond crème, pied de page de l'association. `bodyHtml` doit déjà être échappé. */
export function emailLayout(params: { title: string; bodyHtml: string; footerHtml?: string }): string {
  const { title, bodyHtml, footerHtml } = params;
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:${EMAIL_COLORS.cream};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_COLORS.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLORS.cream};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${EMAIL_COLORS.line};border-radius:16px;overflow:hidden">
<tr><td style="background:${EMAIL_COLORS.blue};padding:18px 24px;color:#ffffff;font-size:20px;font-weight:700">Activ&#39; Sainte-Croix Sport et Culture</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">
<h1 style="margin:0 0 14px;font-size:20px;color:${EMAIL_COLORS.blueDark}">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
${footerHtml ? `<tr><td style="padding:16px 24px;background:${EMAIL_COLORS.cream};border-top:1px solid ${EMAIL_COLORS.line};font-size:13px;color:${EMAIL_COLORS.muted}">${footerHtml}</td></tr>` : ""}
</table>
</td></tr></table>
</body></html>`;
}
