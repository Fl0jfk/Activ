import { Suspense } from "react";
import { redirect } from "next/navigation";
import BureauPageHeader from "@/components/bureau-page-header";
import BureauContentTabs from "@/components/bureau-site-settings";
import { loadBureauPageData } from "@/lib/bureau-page-data";

export const dynamic = "force-dynamic";

export default async function BureauContentPage() {
  const data = await loadBureauPageData();

  if (!data.canManageSite) {
    redirect("/espace");
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 pb-10 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Contenu"
        title="Contenu du site"
        description="Choisissez un onglet pour modifier les actualités, les photos de l’accueil, les informations de l’association ou les disciplines et horaires. Une modification est visible sur le site dès que vous cliquez sur « Publier » ou « Enregistrer »."
      />

      <Suspense fallback={<p className="panel p-6 text-sm text-slate-700">Chargement…</p>}>
        <BureauContentTabs />
      </Suspense>
    </div>
  );
}
