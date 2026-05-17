"use client";

import { useMemo, useState } from "react";
import DossierPanel from "@/components/dossier-panel";
import type { RegistrationApplication } from "@/lib/club-data";
import {
  DOSSIER_STEP_LABELS,
  filterApplicationsByQueue,
  getDossierStep,
  stepBadgeClass,
  type QueueFilter,
} from "@/lib/dossier-workflow";

export type { QueueFilter };

type Discipline = { id: string; name: string };

type RegistrationQueueProps = {
  disciplines: Discipline[];
  applications: RegistrationApplication[];
  queueFilter: QueueFilter;
};

type UpdatePayload = {
  status?: RegistrationApplication["status"];
  dossierPhase?: RegistrationApplication["dossierPhase"];
  trialAttended?: boolean;
  paymentStatus?: RegistrationApplication["paymentStatus"];
  paymentMethod?: RegistrationApplication["paymentMethod"];
};

export default function RegistrationQueue({
  disciplines,
  applications,
  queueFilter,
}: RegistrationQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const filtered = useMemo(
    () => filterApplicationsByQueue(applications, queueFilter),
    [applications, queueFilter]
  );

  async function updateApplication(applicationId: string, payload: UpdatePayload) {
    const response = await fetch(`/api/club/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      window.location.reload();
    } else {
      const body = (await response.json()) as { message?: string };
      setMessage(body.message ?? "Erreur de mise à jour.");
    }
  }

  async function validateEspace(applicationId: string) {
    const response = await fetch(`/api/club/applications/${applicationId}/validate-espace`, {
      method: "POST",
    });
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setMessage(body.message ?? "Espace membre activé.");
      window.location.reload();
    } else {
      setMessage(body.message ?? "Impossible d'activer l'espace.");
    }
  }

  async function rejectApplication(applicationId: string) {
    const response = await fetch(`/api/club/applications/${applicationId}/reject`, {
      method: "POST",
    });
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setMessage(body.message ?? "Dossier refusé.");
      window.location.reload();
    } else {
      setMessage(body.message ?? "Impossible de refuser le dossier.");
    }
  }

  async function requestMissingDocument(applicationId: string) {
    const label = window.prompt("Quelle pièce demander ? (ex: certificat médical)", "certificat médical");
    if (!label) return;
    const response = await fetch(`/api/club/applications/${applicationId}/request-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentLabel: label }),
    });
    const body = (await response.json()) as { message?: string; secureLink?: string };
    if (response.ok) {
      setMessage(
        `${body.message ?? "Demande envoyée."} ${body.secureLink ? `Lien : ${body.secureLink}` : ""}`.trim()
      );
      window.location.reload();
    } else {
      setMessage(body.message ?? "Impossible d'envoyer la demande.");
    }
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
