"use client";

import { useMemo, useState } from "react";
import AdminDashboardPage from "@/app/admin/dashboard/page";
import BureauBroadcastPanel from "@/components/bureau-broadcast-panel";
import CoachAbsencePanel from "@/components/coach-absence-panel";
import RegistrationQueue from "@/components/registration-queue";
import { isDossierEnCours, isDossierFinalise, type QueueFilter } from "@/lib/dossier-workflow";
import ScheduleExceptionsPanel from "@/components/schedule-exceptions-panel";
import SiteNewsPanel from "@/components/site-news-panel";
import TrialSlotsPanel from "@/components/trial-slots-panel";
import type { RegistrationApplication } from "@/lib/club-data";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

type BureauCockpitProps = {
  canManageSite: boolean;
  canApproveCoachAbsences: boolean;
  coachAbsencePendingCount: number;
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
  weekSchedule: WeekScheduleEntry[];
};

export default function BureauCockpit({
  canManageSite,
  canApproveCoachAbsences,
  coachAbsencePendingCount,
  disciplines,
  slots,
  applications,
  weekSchedule,
}: BureauCockpitProps) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("en_cours");
  const [opsOpen, setOpsOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);

  const metrics = useMemo(
    () => ({
      enCours: applications.filter(isDossierEnCours).length,
      finalises: applications.filter(isDossierFinalise).length,
      tous: applications.length,
    }),
    [applications]
  );

  const countsByDiscipline = useMemo(
    () =>
      disciplines
        .map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
          count: applications.filter((a) => a.disciplineId === discipline.id).length,
        }))
        .sort((a, b) => b.count - a.count),
    [applications, disciplines]
  );

  const maxCount = Math.max(1, ...countsByDiscipline.map((item) => item.count));

  const queueSectionTitle =
    queueFilter === "en_cours"
      ? "Dossiers en cours"
      : queueFilter === "finalized"
        ? "Dossiers finalisés"
        : "Tous les dossiers";

  const kpiButtons: { id: QueueFilter; label: string; subtitle: string; value: number; color: string }[] = [
    {
      id: "en_cours",
      label: "En cours",
      subtitle: "Étape indiquée sur chaque dossier",
      value: metrics.enCours,
      color: "bg-amber-100 text-amber-900 ring-amber-400",
    },
    {
      id: "finalized",
      label: "Finalisés",
      subtitle: "Essai validé et paiement reçu",
      value: metrics.finalises,
      color: "bg-emerald-100 text-emerald-900 ring-emerald-400",
    },
    {
      id: "all",
      label: "Tous les dossiers",
      subtitle: "Historique complet",
      value: metrics.tous,
      color: "bg-cyan-100 text-cyan-900 ring-cyan-400",
    },
  ];

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Cockpit bureau</h1>
        <p className="mt-1 text-slate-600">
          {canManageSite
            ? "Direction : inscriptions, planning, absences coach et contenu du site."
            : "Administratif : traiter les pré-inscriptions, essais et planning."}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {kpiButtons.map((kpi) => (
          <button
            key={kpi.id}
            type="button"
            onClick={() => setQueueFilter(kpi.id)}
            className={`rounded-2xl p-4 text-left transition ring-2 ${
              queueFilter === kpi.id ? `${kpi.color} ring-offset-1` : `${kpi.color} ring-transparent opacity-85 hover:opacity-100`
            }`}
          >
            <p className="text-xs font-semibold uppercase opacity-80">{kpi.label}</p>
            <p className="mt-1 text-3xl font-bold">{kpi.value}</p>
            <p className="mt-1 text-xs opacity-75">{kpi.subtitle}</p>
          </button>
        ))}
      </section>

      {canManageSite ? <SiteNewsPanel /> : null}

      <BureauBroadcastPanel disciplines={disciplines} applications={applications} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{queueSectionTitle}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Chaque carte indique l&apos;étape actuelle (pièce manquante, paiement, etc.). Cliquez n&apos;importe
          où sur la carte pour ouvrir le dossier.
        </p>
        <div className="mt-4">
          <RegistrationQueue
            disciplines={disciplines}
            applications={applications}
            queueFilter={queueFilter}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setOpsOpen((open) => !open)}
        >
          <span className="text-lg font-bold text-slate-900">Planning et essais</span>
          <span className="text-sm text-slate-500">{opsOpen ? "Replier" : "Déplier"}</span>
        </button>
        {opsOpen ? (
          <div className="space-y-6 border-t border-slate-100 px-5 pb-5 pt-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Créneaux d&apos;essai</h3>
              <div className="mt-3">
                <TrialSlotsPanel disciplines={disciplines} slots={slots} applications={applications} />
              </div>
            </div>
            <ScheduleExceptionsPanel />
            {weekSchedule.length > 0 ? (
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Vue synthèse — séances cette semaine
                </summary>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {weekSchedule.map((entry) => (
                    <li key={entry.id} className={entry.cancelled ? "text-rose-700 line-through" : ""}>
                      {entry.dayLabel} — {entry.disciplineName} ({entry.startTime}–{entry.endTime})
                      {entry.cancelled && entry.cancelReason ? ` — ${entry.cancelReason}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setStatsOpen((open) => !open)}
        >
          <span className="text-lg font-bold text-slate-900">Statistiques par discipline</span>
          <span className="text-sm text-slate-500">{statsOpen ? "Replier" : "Déplier"}</span>
        </button>
        {statsOpen ? (
          <div className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4">
            {countsByDiscipline.map((item) => (
              <div key={item.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-slate-600">{item.count} demandes</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${Math.max(8, Math.round((item.count / maxCount) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {canApproveCoachAbsences ? (
        <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Absences coach
            {coachAbsencePendingCount > 0 ? (
              <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-sm font-semibold text-white">
                {coachAbsencePendingCount}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Réservé à la direction. Une fois validée, l&apos;absence apparaît sur le site et les
            adhérents de la discipline sont prévenus par email.
          </p>
          <div className="mt-4">
            <CoachAbsencePanel disciplines={disciplines} />
          </div>
        </section>
      ) : null}
      {canManageSite ? (
        <section>
          <h2 className="mb-3 text-xl font-bold text-slate-900">Contenu du site</h2>
          <p className="mb-4 text-sm text-slate-600">
            Informations générales, organigramme et disciplines.
          </p>
          <AdminDashboardPage embedded />
        </section>
      ) : null}
    </div>
  );
}
