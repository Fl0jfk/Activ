import type { Metadata } from "next";
import localFont from "next/font/local";
import AppClerkProvider from "@/components/clerk-provider";
import Header from "@/components/header";
import JsonLd from "@/components/json-ld";
import {
  DEFAULT_OG_IMAGE,
  organizationJsonLd,
  SITE_LOCALITY,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_URL,
} from "@/lib/seo";
import SiteFooter from "@/components/site-footer";
import { readPublicSiteData } from "@/lib/site-data";
import "./globals.css";

// Police hébergée dans le projet (src/fonts) : aucune requête vers Google Fonts.
const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_SHORT_NAME} – Sport et culture à ${SITE_LOCALITY}`,
    template: `%s | ${SITE_SHORT_NAME}`,
  },
  description: "Association sportive et culturelle de Sainte-Croix-sur-Buchy : disciplines, planning et pré-inscription.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: "summary" },
};

export default async function RootLayout({ children}: Readonly<{ children: React.ReactNode;}>) {
  const data = await readPublicSiteData();
  return (
    <AppClerkProvider>
      <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-brand-cream text-slate-900">
          <Header
            facebookUrl={data.association.facebookUrl}
            showNewsNav={data.news.length > 0 || data.polls.length > 0}
          />
          {children}
          <div className="h-14 shrink-0" aria-hidden />
          <SiteFooter
            address={data.association.address}
            facebookUrl={data.association.facebookUrl}
            hasNews={data.news.length > 0 || data.polls.length > 0}
            hasPhotos={data.homeGallery.slides.length > 0}
          />
          <JsonLd data={organizationJsonLd(data.association)} />
        </body>
      </html>
    </AppClerkProvider>
  );
}
