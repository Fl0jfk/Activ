import BureauDossiersView from "@/components/bureau-dossiers-view";
import BureauPageHeader from "@/components/bureau-page-header";
import ManualMemberPanel from "@/components/manual-member-panel";
import { loadBureauPageData } from "@/lib/bureau-page-data";
import { getDossierStep, type QueueFilter } from "@/lib/dossier-workflow";

export const dynamic = "force-dynamic";

export default async function BureauDossiersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const [data, params] = await Promise.all([loadBureauPageData(), searchParams]);
  const initialFilter: QueueFilter =
    params.filtre === "finalized" || params.filtre === "all" ? params.filtre : "en_cours";

  const enCours = data.applications.filter((application) => {
    const step = getDossierStep(application);
    return step !== "finalized" && step !== "rejected" && step !== "cancelled";
  }).length;

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Dossiers"
        title="Dossiers d’adhésion"
        description="File de traitement des pré-inscriptions, validation des pièces et enregistrement des adhésions papier reçues au bureau."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {enCours} à traiter
          </span>
        }
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <BureauDossiersView
          disciplines={data.disciplines}
          applications={data.applications}
          initialFilter={initialFilter}
        />
        <div id="adherent-papier" className="anchor-section min-w-0">
          <ManualMemberPanel disciplines={data.disciplines} />
        </div>
      </div>
    </div>
  );
}
