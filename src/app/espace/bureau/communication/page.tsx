import Link from "next/link";
import BureauBroadcastPanel from "@/components/bureau-broadcast-panel";
import BureauPageHeader from "@/components/bureau-page-header";
import { loadBureauPageData } from "@/lib/bureau-page-data";
import { isDossierFinalise } from "@/lib/dossier-workflow";

export const dynamic = "force-dynamic";

export default async function BureauCommunicationPage() {
  const data = await loadBureauPageData();
  const contactableMembers = data.applications.filter(isDossierFinalise).length;

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Communication"
        title="Envoyer un e-mail"
        description="Un message à tous les adhérents, à une activité ou à une personne. Chaque destinataire reçoit un e-mail individuel."
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <BureauBroadcastPanel
          disciplines={data.disciplines}
          applications={data.applications}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <section className="bento-card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Audience
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Destinataires disponibles
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50/80 px-3 py-2.5">
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  {contactableMembers}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">Adhérents à jour</p>
              </div>
              <div className="rounded-2xl bg-slate-50/80 px-3 py-2.5">
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  {data.disciplines.length}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">Activités</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Les adresses ne sont jamais visibles entre destinataires : un e-mail est envoyé
              individuellement à chaque personne.
            </p>
          </section>

          <section className="bento-card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Support
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Demandes & renouvellements
            </h2>
            <div className="mt-4 space-y-2">
              <Link
                href="/espace/bureau/adherents#demandes"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:border-slate-200 hover:bg-white"
              >
                <span className="text-sm font-medium text-slate-700">Demandes membres</span>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  {data.memberRequestPendingCount}
                  <span className="text-slate-300 transition group-hover:text-slate-500">→</span>
                </span>
              </Link>
              <Link
                href="/espace/bureau/adherents#renouvellements"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:border-slate-200 hover:bg-white"
              >
                <span className="text-sm font-medium text-slate-700">Licences à renouveler</span>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  {data.renewalCount}
                  <span className="text-slate-300 transition group-hover:text-slate-500">→</span>
                </span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
