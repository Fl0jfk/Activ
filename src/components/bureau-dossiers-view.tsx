"use client";

import { useMemo, useState } from "react";
import RegistrationQueue from "@/components/registration-queue";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  getApplicationDisciplineIds,
  getDossierStep,
  type QueueFilter,
} from "@/lib/dossier-workflow";

type BureauDossiersViewProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
  initialFilter?: QueueFilter;
  /** Identifiant de la discipline présélectionnée (lien direct `?discipline=<slug>`). */
  initialDisciplineId?: string | null;
};

/** Met à jour l'URL sans recharger, pour qu'un listing filtré puisse être mis en favori. */
function syncUrl(queueFilter: QueueFilter, discipline: DisciplineOption | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("filtre", queueFilter);
  if (discipline) {
    url.searchParams.set("discipline", discipline.slug);
  } else {
    url.searchParams.delete("discipline");
  }
  window.history.replaceState(null, "", url.toString());
}

export default function BureauDossiersView({
  disciplines,
  applications,
  initialFilter = "en_cours",
  initialDisciplineId = null,
}: BureauDossiersViewProps) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(initialFilter);
  const [disciplineId, setDisciplineId] = useState<string | null>(
    initialDisciplineId && disciplines.some((d) => d.id === initialDisciplineId)
      ? initialDisciplineId
      : null,
  );
  const selectedDiscipline = disciplines.find((d) => d.id === disciplineId) ?? null;

  /** Nombre de dossiers par discipline (un dossier multi-activités compte dans chacune). */
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
        ? applications.filter((application) =>
            getApplicationDisciplineIds(application).includes(disciplineId),
          )
        : applications,
    [applications, disciplineId],
  );

  function changeQueueFilter(next: QueueFilter) {
    setQueueFilter(next);
    syncUrl(next, selectedDiscipline);
  }

  function changeDiscipline(nextId: string | null) {
    setDisciplineId(nextId);
    syncUrl(queueFilter, disciplines.find((d) => d.id === nextId) ?? null);
  }

  const metrics = useMemo(() => {
    let enCours = 0;
    let finalises = 0;
    let exclus = 0;

    for (const application of disciplineApplications) {
      const step = getDossierStep(application);
      if (step === "finalized") {
        finalises += 1;
      } else if (step === "rejected" || step === "cancelled") {
        exclus += 1;
      } else {
        enCours += 1;
      }
    }

    return { enCours, finalises, exclus, tous: disciplineApplications.length };
  }, [disciplineApplications]);

  const filterOptions: { id: QueueFilter; label: string; value: number }[] = [
    { id: "en_cours", label: "En cours", value: metrics.enCours },
    { id: "finalized", label: "Finalisés", value: metrics.finalises },
    { id: "all", label: "Tous", value: metrics.tous },
  ];

  const statusSubtitle =
    queueFilter === "en_cours"
      ? "Dossiers qui demandent une action du bureau."
      : queueFilter === "finalized"
        ? "Dossiers finalisés et paiement encaissé."
        : "Historique complet des demandes.";
  const subtitle = selectedDiscipline
    ? `${selectedDiscipline.name} — ${statusSubtitle.charAt(0).toLowerCase()}${statusSubtitle.slice(1)}`
    : statusSubtitle;

  return (
    <section className="bento-card min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
            Traitement
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            Dossiers d&apos;adhésion
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-slate-200 bg-slate-100/80 p-1">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => changeQueueFilter(option.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                queueFilter === option.id
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {option.label}
              <span className="ml-1.5 text-[10px] text-slate-500">{option.value}</span>
            </button>
          ))}
        </div>
      </div>

      {disciplines.length > 0 ? (
        <div className="mt-4">
          <label
            htmlFor="dossiers-discipline-filter"
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
          >
            Discipline
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <select
              id="dossiers-discipline-filter"
              value={disciplineId ?? ""}
              onChange={(event) => changeDiscipline(event.target.value || null)}
              className="min-w-0 max-w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              <option value="">Toutes les disciplines ({applications.length})</option>
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name} ({disciplineCounts.get(discipline.id) ?? 0})
                </option>
              ))}
            </select>
            {selectedDiscipline ? (
              <button
                type="button"
                onClick={() => changeDiscipline(null)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
              >
                Voir tous les adhérents
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <RegistrationQueue
          disciplines={disciplines}
          applications={disciplineApplications}
          queueFilter={queueFilter}
        />
      </div>
    </section>
  );
}
