"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/bureau-ui";
import RegistrationQueue from "@/components/registration-queue";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { replaceUrlParams } from "@/lib/bureau-navigation";
import { DOSSIER_SORT_LABELS, type DossierSort } from "@/lib/dossier-format";
import {
  STEP_FILTER_LABELS,
  getApplicationDisciplineIds,
  isDossierEnCours,
  isDossierFinalise,
  isDossierRefuse,
  parseQueueFilter,
  parseStepFilter,
  type QueueFilter,
} from "@/lib/dossier-workflow";

type BureauDossiersViewProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
};

const TAB_DESCRIPTIONS: Record<QueueFilter, string> = {
  en_cours: "Dossiers qui demandent une action du bureau.",
  finalized: "Inscriptions terminées, paiement enregistré.",
  refuses: "Dossiers refusés et adhérents désinscrits.",
  all: "Historique complet des dossiers.",
};

/**
 * Liste des dossiers. Les filtres vivent dans l’adresse de la page (`filtre`, `etape`, `discipline`) :
 * les liens du cockpit et les favoris fonctionnent, et le changement d’onglet ne recharge rien.
 */
export default function BureauDossiersView({ disciplines, applications }: BureauDossiersViewProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DossierSort>("recent");

  const queueFilter = parseQueueFilter(searchParams.get("filtre"));
  const stepFilter = queueFilter === "en_cours" ? parseStepFilter(searchParams.get("etape")) : null;
  const disciplineParam = searchParams.get("discipline");
  const selectedDiscipline =
    disciplines.find((d) => d.slug === disciplineParam || d.id === disciplineParam) ?? null;
  const disciplineId = selectedDiscipline?.id ?? null;

  /** Nombre de dossiers par activité (un dossier multi-activités compte dans chacune). */
  const disciplineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const application of applications) {
      for (const id of getApplicationDisciplineIds(application)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [applications]);

  const disciplineApplications = useMemo(
    () =>
      disciplineId
        ? applications.filter((application) => getApplicationDisciplineIds(application).includes(disciplineId))
        : applications,
    [applications, disciplineId],
  );

  const counts = useMemo(
    () => ({
      en_cours: disciplineApplications.filter(isDossierEnCours).length,
      finalized: disciplineApplications.filter(isDossierFinalise).length,
      refuses: disciplineApplications.filter(isDossierRefuse).length,
      all: disciplineApplications.length,
    }),
    [disciplineApplications],
  );

  const tabs: { id: QueueFilter; label: string }[] = [
    { id: "en_cours", label: "En cours" },
    { id: "finalized", label: "Finalisés" },
    { id: "refuses", label: "Refusés et désinscrits" },
    { id: "all", label: "Tous" },
  ];

  function changeTab(next: QueueFilter) {
    replaceUrlParams((params) => {
      params.set("filtre", next);
      params.delete("etape");
    });
  }

  function clearStep() {
    replaceUrlParams((params) => params.delete("etape"));
  }

  function changeDiscipline(nextId: string) {
    const next = disciplines.find((d) => d.id === nextId) ?? null;
    replaceUrlParams((params) => {
      if (next) params.set("discipline", next.slug);
      else params.delete("discipline");
    });
  }

  const filterKey = [queueFilter, stepFilter ?? "", disciplineId ?? "", query, sort].join("|");
  const description = selectedDiscipline
    ? `${selectedDiscipline.name} : ${TAB_DESCRIPTIONS[queueFilter].charAt(0).toLowerCase()}${TAB_DESCRIPTIONS[queueFilter].slice(1)}`
    : TAB_DESCRIPTIONS[queueFilter];

  return (
    <SectionCard id="dossiers" eyebrow="Traitement" title="Dossiers d’adhésion" description={description}>
      <div className="space-y-4">
        <div role="group" aria-label="Type de dossiers" className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = queueFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => changeTab(tab.id)}
                className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="field-label">
            Rechercher un adhérent
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, prénom ou adresse e-mail"
              className="field"
              autoComplete="off"
            />
          </label>
          {disciplines.length > 0 ? (
            <label className="field-label">
              Activité
              <select
                value={disciplineId ?? ""}
                onChange={(event) => changeDiscipline(event.target.value)}
                className="field"
              >
                <option value="">Toutes les activités ({applications.length})</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name} ({disciplineCounts.get(discipline.id) ?? 0})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field-label">
            Trier par
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as DossierSort)}
              className="field"
            >
              {(Object.keys(DOSSIER_SORT_LABELS) as DossierSort[]).map((key) => (
                <option key={key} value={key}>
                  {DOSSIER_SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {stepFilter || selectedDiscipline ? (
          <div className="flex flex-wrap items-center gap-2">
            {stepFilter ? (
              <button
                type="button"
                onClick={clearStep}
                aria-label={`Retirer le filtre Étape : ${STEP_FILTER_LABELS[stepFilter]}`}
                className="btn btn-outline btn-sm"
              >
                Étape : {STEP_FILTER_LABELS[stepFilter]} <span aria-hidden="true">✕</span>
              </button>
            ) : null}
            {selectedDiscipline ? (
              <button type="button" onClick={() => changeDiscipline("")} className="btn btn-ghost btn-sm">
                Toutes les activités
              </button>
            ) : null}
          </div>
        ) : null}

        <RegistrationQueue
          disciplines={disciplines}
          applications={disciplineApplications}
          queueFilter={queueFilter}
          stepFilter={stepFilter}
          query={query}
          sort={sort}
          filterKey={filterKey}
        />
      </div>
    </SectionCard>
  );
}
