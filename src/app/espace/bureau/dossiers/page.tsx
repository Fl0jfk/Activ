import Link from "next/link";
import BureauDossiersView from "@/components/bureau-dossiers-view";
import BureauPageHeader from "@/components/bureau-page-header";
import { SectionCard } from "@/components/bureau-ui";
import ManualMemberPanel from "@/components/manual-member-panel";
import MemberContactRequestsPanel from "@/components/member-contact-requests-panel";
import { loadBureauPageData } from "@/lib/bureau-page-data";
import { matchesStepFilter, type StepFilter } from "@/lib/dossier-workflow";

export const dynamic = "force-dynamic";

type TodoTile = {
  key: string;
  label: string;
  hint: string;
  count: number;
  href: string;
};

export default async function BureauDossiersPage() {
  const data = await loadBureauPageData();

  const countStep = (step: StepFilter) =>
    data.applications.filter((application) => matchesStepFilter(application, step)).length;

  const tiles: TodoTile[] = [
    {
      key: "a_examiner",
      label: "À examiner",
      hint: "Nouveaux dossiers et espaces adhérents à valider",
      count: countStep("a_examiner"),
      href: "/espace/bureau/dossiers?filtre=en_cours&etape=a_examiner#dossiers",
    },
    {
      key: "pieces",
      label: "Pièces manquantes",
      hint: "En attente d’un document de l’adhérent",
      count: countStep("pieces"),
      href: "/espace/bureau/dossiers?filtre=en_cours&etape=pieces#dossiers",
    },
    {
      key: "paiement",
      label: "Paiements en attente",
      hint: "Paiement à enregistrer",
      count: countStep("paiement"),
      href: "/espace/bureau/dossiers?filtre=en_cours&etape=paiement#dossiers",
    },
    {
      key: "modifications",
      label: "Changements de coordonnées",
      hint: "Demandes des adhérents à valider",
      count: data.contactChangeRequests.length,
      href: "/espace/bureau/dossiers#modifications",
    },
  ];
  const nothingToDo = tiles.every((tile) => tile.count === 0);

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Dossiers"
        title="Dossiers d’adhésion"
        description="Traitez les inscriptions reçues, vérifiez les pièces, enregistrez les paiements et ajoutez les adhérents papier."
        action={
          <a href="#adherent-papier" className="btn btn-outline btn-sm">
            + Adhérent papier
          </a>
        }
      />

      <SectionCard
        eyebrow="À traiter"
        title="Ce qui attend le bureau"
        description={
          nothingToDo
            ? "Tout est à jour : aucun dossier n’attend d’action pour le moment."
            : "Cliquez sur une case pour afficher les dossiers concernés."
        }
        action={
          <Link href="/espace/bureau/dossiers?filtre=en_cours#dossiers" className="btn btn-ghost btn-sm">
            Tous les dossiers en cours
          </Link>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.key} className="min-w-0">
              <Link
                href={tile.href}
                className={`flex h-full min-h-28 flex-col justify-between rounded-2xl border p-4 transition hover:-translate-y-px ${
                  tile.count > 0
                    ? "border-brand-blue/30 bg-brand-blue/5 hover:bg-brand-blue/10"
                    : "border-brand-line bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <span className="text-[15px] font-bold text-slate-900">{tile.label}</span>
                <span
                  className={`mt-1 text-4xl font-extrabold leading-none ${
                    tile.count > 0 ? "text-brand-blue-dark" : "text-slate-500"
                  }`}
                >
                  {tile.count}
                </span>
                <span className="mt-2 text-sm text-slate-600">{tile.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <MemberContactRequestsPanel
        requests={data.contactChangeRequests}
        applications={data.applications}
      />

      <ManualMemberPanel disciplines={data.disciplines} />

      <BureauDossiersView disciplines={data.disciplines} applications={data.applications} />
    </div>
  );
}
