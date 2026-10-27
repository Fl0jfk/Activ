"use client";

import { useMemo, useState } from "react";
import RegistrationQueue from "@/components/registration-queue";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { getDossierStep, type QueueFilter } from "@/lib/dossier-workflow";

type BureauDossiersViewProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
  initialFilter?: QueueFilter;
};

export default function BureauDossiersView({
  disciplines,
  applications,
  initialFilter = "en_cours",
}: BureauDossiersViewProps) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(initialFilter);

  const metrics = useMemo(() => {
    let enCours = 0;
    let finalises = 0;
    let exclus = 0;

    for (const application of applications) {
      const step = getDossierStep(application);
      if (step === "finalized") {
        finalises += 1;
      } else if (step === "rejected" || step === "cancelled") {
        exclus += 1;
      } else {
        enCours += 1;
      }
    }

    return { enCours, finalises, exclus, tous: applications.length };
  }, [applications]);

  const filterOptions: { id: QueueFilter; label: string; value: number }[] = [
    { id: "en_cours", label: "En cours", value: metrics.enCours },
    { id: "finalized", label: "Finalisés", value: metrics.finalises },
    { id: "all", label: "Tous", value: metrics.tous },
  ];

  const subtitle =
    queueFilter === "en_cours"
      ? "Dossiers qui demandent une action du bureau."
      : queueFilter === "finalized"
        ? "Dossiers finalisés et paiement encaissé."
        : "Historique complet des demandes.";

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
              onClick={() => setQueueFilter(option.id)}
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

      <div className="mt-5">
        <RegistrationQueue
          disciplines={disciplines}
          applications={applications}
          queueFilter={queueFilter}
        />
      </div>
    </section>
  );
}
