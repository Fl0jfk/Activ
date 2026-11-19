import BureauPageHeader from "@/components/bureau-page-header";
import LicenseRenewalPanel from "@/components/license-renewal-panel";
import MemberRequestsPanel from "@/components/member-requests-panel";
import { loadBureauPageData } from "@/lib/bureau-page-data";

export const dynamic = "force-dynamic";

export default async function BureauAdherentsPage() {
  const data = await loadBureauPageData();

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Demandes"
        title="Demandes et licences"
        description="Répondez aux demandes envoyées depuis l’espace personnel des adhérents et renouvelez les licences qui arrivent à échéance."
      />

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
        <MemberRequestsPanel />
        <LicenseRenewalPanel disciplines={data.disciplines} applications={data.applications} />
      </div>
    </div>
  );
}
