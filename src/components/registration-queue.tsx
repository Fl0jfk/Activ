"use client";

import { useMemo, useState } from "react";
import DossierPanel from "@/components/dossier-panel";
import { useClubApplicationActions } from "@/hooks/useClubApplicationActions";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  DOSSIER_STEP_LABELS,
  filterApplicationsByQueue,
  getDossierStep,
  stepBadgeClass,
  type QueueFilter,
} from "@/lib/dossier-workflow";

export type { QueueFilter };

type RegistrationQueueProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
  queueFilter: QueueFilter;
};

export default function RegistrationQueue({
  disciplines,
  applications,
  queueFilter,
}: RegistrationQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { message, setMessage, updateApplication, validateEspace, rejectApplication, requestDocument } =
    useClubApplicationActions();

  const filtered = useMemo(
    () => filterApplicationsByQueue(applications, queueFilter),
    [applications, queueFilter],
  );

  async function requestMissingDocument(applicationId: string) {
    const label = window.prompt("Quelle pièce demander ? (ex: certificat médical)", "certificat médical");
    if (!label) {
      return;
    }
    await requestDocument(applicationId, label);
  }

  function toggleExpanded(applicationId: string) {
    setExpandedId((current) => (current === applicationId ? null : applicationId));
  }

  if (filtered.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        Aucun dossier pour ce filtre.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((application) => {
        const disciplineName =
          disciplines.find((d) => d.id === application.disciplineId)?.name ?? "Discipline";
        const isExpanded = expandedId === application.id;
        const step = getDossierStep(application);

        return (
          <article
            key={application.id}
            role="button"
            tabIndex={0}
            onClick={() => toggleExpanded(application.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleExpanded(application.id);
              }
            }}
            className={`w-full cursor-pointer rounded-xl border p-4 text-left transition hover:ring-2 hover:ring-cyan-200 ${
              isExpanded ? "border-cyan-300 bg-cyan-50/40 ring-2 ring-cyan-300" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-cyan-700">{disciplineName}</p>
                <p className="font-semibold text-slate-900">{application.fullName}</p>
                <p className="text-sm text-slate-600">{application.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-block max-w-[11rem] rounded-full px-2 py-1 text-xs font-semibold leading-snug ${stepBadgeClass(step)}`}
                >
                  {DOSSIER_STEP_LABELS[step]}
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  Essai : {application.trialAttended ? "réalisé" : "non réalisé"}
                </p>
              </div>
            </div>

            {!isExpanded ? (
              <p className="mt-3 text-xs text-slate-500">Ouvrir le dossier pour traiter</p>
            ) : (
              <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                <DossierPanel
                  application={application}
                  disciplineName={disciplineName}
                  onUpdate={updateApplication}
                  onRequestDocument={requestMissingDocument}
                  onValidateEspace={validateEspace}
                  onReject={rejectApplication}
                  onMessage={setMessage}
                />
              </div>
            )}
          </article>
        );
      })}

      {message ? (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{message}</p>
      ) : null}
    </div>
  );
}
