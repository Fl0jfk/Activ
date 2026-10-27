import { redirect } from "next/navigation";
import BureauPageHeader from "@/components/bureau-page-header";
import BureauSiteSettingsPanel from "@/components/bureau-site-settings";
import HomeGalleryPanel from "@/components/home-gallery-panel";
import SiteNewsPanel from "@/components/site-news-panel";
import { loadBureauPageData } from "@/lib/bureau-page-data";

export const dynamic = "force-dynamic";

export default async function BureauContentPage() {
  const data = await loadBureauPageData();

  if (!data.canManageSite) {
    redirect("/espace");
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Contenu"
        title="Contenu du site"
        description="Publiez les actualités, gérez le slider d’accueil et les informations de l’association. Les actualités de plus d’un mois sont rangées dans les archives."
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <SiteNewsPanel />
        <HomeGalleryPanel />
      </div>

      <BureauSiteSettingsPanel />
    </div>
  );
}
