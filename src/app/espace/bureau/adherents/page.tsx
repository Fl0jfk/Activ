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
        eyebrow="Bureau · Adhérents"
        title="Demandes & renouvellements"
        description="Traitez les demandes envoyées depuis l’espace personnel et relancez les licences arrivant à échéance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
              {data.memberRequestPendingCount} demande
              {data.memberRequestPendingCount > 1 ? "s" : ""} en attente
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
              {data.renewalCount} renouvellement{data.renewalCount > 1 ? "s" : ""}
            </span>
          </div>
        }
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <section id="demandes" className="anchor-section bento-card min-w-0 p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Support
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Demandes des membres
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Demandes envoyées depuis l’espace personnel. Passage en « En cours » puis « Traitée »
              avec message et pièce jointe optionnelle.
            </p>
          </div>
          <MemberRequestsPanel />
        </section>

        <div id="renouvellements" className="anchor-section min-w-0">
          <LicenseRenewalPanel
            disciplines={data.disciplines}
            applications={data.applications}
          />
        </div>
      </div>
    </div>
  );
}
