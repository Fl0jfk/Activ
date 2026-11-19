import type { Metadata } from "next";
import { ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import type { AssociationData, SiteNewsItem } from "@/lib/site-data-types";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://activsaintecroix.fr").replace(/\/+$/, "");
export const SITE_NAME = "Activ' Sainte-Croix Sport et Culture";
export const SITE_SHORT_NAME = "Activ' Sainte-Croix";
export const SITE_LOCALITY = "Sainte-Croix-sur-Buchy";
export const DEFAULT_OG_IMAGE = { url: "/logo.png", width: 561, height: 445, alt: SITE_NAME };

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Texte brut (sans emojis ni retours à la ligne) tronqué pour une meta description. */
export function toMetaDescription(text: string, maxLength = 158): string {
  const cleaned = text.replace(EMOJI_PATTERN, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).replace(/[\s,;:.\-–]+$/, "")}…`;
}

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  absoluteTitle?: boolean;
  noindex?: boolean;
};

/** Metadata complète d'une page : canonical, Open Graph et Twitter (les enfants écrasent openGraph du layout). */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
  absoluteTitle = false,
  noindex = false,
}: PageMetadataInput): Metadata {
  const images = image ? [{ url: image, alt: imageAlt ?? title }] : [DEFAULT_OG_IMAGE];
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_SHORT_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type,
      locale: "fr_FR",
      siteName: SITE_NAME,
      url: path,
      title: socialTitle,
      description,
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: socialTitle,
      description,
      images: images.map((entry) => entry.url),
    },
  };
}

export const NOINDEX_METADATA: Metadata = { robots: { index: false, follow: false } };

export function organizationJsonLd(association: AssociationData["association"]) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: SITE_SHORT_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    image: absoluteUrl("/logo.png"),
    description: "Association sportive et culturelle de Sainte-Croix-sur-Buchy : cours, randonnées et ateliers.",
    telephone: ASSOCIATION_PHONE_TEL.replace("tel:", ""),
    address: {
      "@type": "PostalAddress",
      streetAddress: association.address?.replace(/\d{5}.*$/, "").replace(/[,\s]+$/, "") || undefined,
      addressLocality: SITE_LOCALITY,
      postalCode: "76750",
      addressRegion: "Normandie",
      addressCountry: "FR",
    },
    areaServed: SITE_LOCALITY,
    sameAs: association.facebookUrl ? [association.facebookUrl] : undefined,
  };
}

export function newsJsonLd(item: SiteNewsItem, url: string) {
  const image = item.imageUrl ? [absoluteUrl(item.imageUrl)] : undefined;
  const organizer = { "@id": `${SITE_URL}/#organization` };
  const base = {
    "@context": "https://schema.org",
    "@id": `${url}#page`,
    name: item.title,
    url,
    image,
    description: toMetaDescription(item.description || item.title),
    organizer,
  };
  if (item.date && item.startTime && item.location) {
    const startDate = `${item.date}T${item.startTime}:00`;
    const endDate = item.endTime ? `${item.date}T${item.endTime}:00` : undefined;
    return {
      ...base,
      "@type": "Event",
      startDate,
      endDate,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: item.location,
        address: { "@type": "PostalAddress", addressLocality: SITE_LOCALITY, addressCountry: "FR" },
      },
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#page`,
    headline: item.title.slice(0, 110),
    mainEntityOfPage: url,
    image,
    datePublished: item.date || undefined,
    description: base.description,
    author: organizer,
    publisher: organizer,
  };
}
