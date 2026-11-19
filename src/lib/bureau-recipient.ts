import { readSiteData } from "@/lib/site-data";

/**
 * Adresse qui reçoit les messages destinés au bureau (formulaire de contact, nouvelles inscriptions, pièces reçues).
 * Même règle partout : CONTACT_TO, sinon l'e-mail de contact de l'association, sinon le compte SMTP.
 */
export async function resolveBureauRecipient(): Promise<string | null> {
  const fromEnv = process.env.CONTACT_TO?.trim();
  if (fromEnv) return fromEnv;
  try {
    const siteData = await readSiteData();
    const fromSite = siteData.association.contactEmail?.trim();
    if (fromSite) return fromSite;
  } catch (error) {
    console.error("resolveBureauRecipient: lecture des données du site impossible", error);
  }
  return process.env.SMTP_USER?.trim() || null;
}
