"use client";

import { useEffect, useRef } from "react";
import { Badge, StatusMessage, type Feedback } from "@/components/bureau-ui";
import DossierPanel from "@/components/dossier-panel";
import type { ClubApplicationActions } from "@/hooks/useClubApplicationActions";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { formatDateFr } from "@/lib/dossier-format";
import { getApplicationDisciplineNames, getDossierBadge } from "@/lib/dossier-workflow";

type DossierCardProps = {
  application: RegistrationApplication;
  disciplines: DisciplineOption[];
  expanded: boolean;
  /** Le dossier ne correspond plus aux filtres actuels : il reste affiché tant qu’il est ouvert. */
  outsideFilters: boolean;
  feedback: Feedback;
  actions: ClubApplicationActions;
  onToggle: () => void;
};

function trialBadge(application: RegistrationApplication): string | null {
  if (application.trialAttended) return "Essai réalisé";
  if (application.requestKind === "trial_only" || application.trialSlotId) return "Essai à venir";
  return null;
}

export default function DossierCard({
  application,
  disciplines,
  expanded,
  outsideFilters,
  feedback,
  actions,
  onToggle,
}: DossierCardProps) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const badge = getDossierBadge(application);
  const activities = getApplicationDisciplineNames(application, disciplines);
  const trial = trialBadge(application);
  const panelId = `dossier-${application.id}`;

  useEffect(() => {
    if (feedback) feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [feedback]);

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-2xl border bg-white transition ${
        expanded ? "border-brand-blue shadow-[0_10px_30px_-20px_rgba(31,111,208,0.6)]" : "border-brand-line"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={onToggle}
        className={`flex w-full min-w-0 flex-col gap-3 px-4 py-4 text-left transition hover:bg-brand-cream/70 sm:flex-row sm:items-start sm:justify-between sm:px-5 ${
          expanded ? "bg-brand-blue/5" : ""
        }`}
      >
        <span className="block min-w-0 flex-1">
          <span className="text-break block text-base font-extrabold text-slate-900">{application.fullName}</span>
          {application.email ? (
            <span className="text-break mt-0.5 block text-sm text-slate-600">{application.email}</span>
          ) : (
            <span className="mt-0.5 block text-sm text-slate-600">Sans adresse e-mail</span>
          )}
          {activities.length > 0 ? (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {activities.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-brand-line bg-brand-cream px-2.5 py-0.5 text-xs font-bold text-slate-700"
                >
                  {name}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end sm:text-right">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="text-sm text-slate-600">Reçu le {formatDateFr(application.createdAt) || "—"}</span>
          {application.origin === "paper" || trial ? (
            <span className="flex flex-wrap gap-1.5 sm:justify-end">
              {application.origin === "paper" ? <Badge tone="slate">Papier</Badge> : null}
              {trial ? <Badge tone={application.trialAttended ? "green" : "slate"}>{trial}</Badge> : null}
            </span>
          ) : null}
          <span className="text-sm font-bold text-brand-blue">{expanded ? "Fermer ▲" : "Ouvrir ▼"}</span>
        </span>
      </button>

      {feedback || outsideFilters ? (
        <div ref={feedbackRef} className="space-y-2 px-4 pb-4 sm:px-5">
          <StatusMessage feedback={feedback} />
          {outsideFilters ? (
            <p className="text-sm text-slate-600">
              Ce dossier n’apparaît plus dans cet onglet. Il disparaîtra de la liste quand vous le fermerez.
            </p>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <div id={panelId} className="border-t border-brand-line px-4 py-5 sm:px-5">
          <DossierPanel application={application} disciplines={disciplines} actions={actions} />
        </div>
      ) : null}
    </article>
  );
}
