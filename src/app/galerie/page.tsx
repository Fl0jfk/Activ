import type { Metadata } from "next";
import Link from "next/link";
import PhotoMosaic from "@/components/photo-mosaic";
import { buildPageMetadata, SITE_LOCALITY } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Photos de l'association",
  description: `Les photos de la vie d'Activ' Sainte-Croix : cours, randonnées et événements à ${SITE_LOCALITY}.`,
  path: "/galerie",
});

export default async function GaleriePage() {
  const data = await readPublicSiteData();
  const slides = [...data.homeGallery.slides].reverse();
  const title = data.homeGallery.title || "La vie de l'association";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Retour à l&apos;accueil
      </Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">
        {slides.length} photo{slides.length > 1 ? "s" : ""}, des plus récentes aux plus anciennes. Cliquez sur une photo
        pour l&apos;agrandir.
      </p>
      <div className="mt-8">
        {slides.length > 0 ? (
          <PhotoMosaic slides={slides} fallbackAlt={title} />
        ) : (
          <p className="rounded-2xl border border-brand-line bg-white px-5 py-8 text-center text-slate-600">
            Aucune photo pour le moment.
          </p>
        )}
      </div>
    </main>
  );
}
