import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
import { readSiteData } from "@/lib/site-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  const data = await readSiteData();
  return (
    <AppClerkProvider>
      <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
          <Header
            facebookUrl={data.association.facebookUrl}
            showNewsNav={data.news.length > 0 || data.polls.length > 0}
            showGalleryNav={data.homeGallery.slides.length > 0}
          />
          {children}
          <JsonLd data={organizationJsonLd(data.association)} />
        </body>
      </html>
    </AppClerkProvider>
  );
}
