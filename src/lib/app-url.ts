/**
 * Adresse publique du site, sans « / » final, pour les liens placés dans les e-mails.
 * Ordre : NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, puis l'adresse du site en production
 * (jamais localhost dans un e-mail envoyé aux adhérents).
 */
export function appBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL)?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.warn("NEXT_PUBLIC_APP_URL est absente : les liens des e-mails utilisent https://activsaintecroix.fr.");
    return "https://activsaintecroix.fr";
  }
  return "http://localhost:3000";
}
