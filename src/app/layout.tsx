import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/header";
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
  title: "Activ' Sainte-Croix Sport et Culture",
  description:"Association sportive locale: disciplines, planning et informations pratiques.",
};

export default async function RootLayout({ children}: Readonly<{ children: React.ReactNode;}>) {
  const data = await readSiteData();
  return (
    <ClerkProvider>
      <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
          <Header facebookUrl={data.association.facebookUrl} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
