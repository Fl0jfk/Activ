"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  BarChart,
  DonutChart,
  HorizontalBars,
  RadialProgress,
  Sparkline,
  StackedBarChart,
} from "@/components/bureau-cockpit-charts";
import type { RegistrationApplication } from "@/lib/club-data";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  getDossierStep,
  type DossierStep,
  type QueueFilter,
} from "@/lib/dossier-workflow";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

type BureauCockpitProps = {
  canManageSite: boolean;
  canApproveCoachAbsences: boolean;
  coachAbsencePendingCount: number;
  memberRequestPendingCount: number;
  renewalCount: number;
  newsCount: number;
  galleryCount: number;
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
  weekSchedule: WeekScheduleEntry[];
};

const ICON_PATHS = {
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </>
  ),
  arrow: (
    <>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9L12 3Z" />
      <path d="M5 19v-2M4 18h2M19 5V3M18 4h2" />
    </>
  ),
} as const;

type IconName = keyof typeof ICON_PATHS;

const TONE_STYLES = {
  cyan: {
    icon: "bg-cyan-50 text-cyan-700",
    solid: "bg-cyan-500",
    soft: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700",
    solid: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    solid: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700",
    solid: "bg-violet-500",
    soft: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  rose: {
    icon: "bg-rose-50 text-rose-700",
    solid: "bg-rose-500",
    soft: "bg-rose-50 text-rose-700 ring-rose-100",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600",
    solid: "bg-slate-500",
    soft: "bg-slate-100 text-slate-700 ring-slate-200",
  },
} as const;

type Tone = keyof typeof TONE_STYLES;

const DISCIPLINE_COLORS = [
  "#0891b2",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#64748b",
];

const TEACHING_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      id={id}
      className="anchor-section flex flex-wrap items-end justify-between gap-3 pt-2"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  eyebrow,
  label,
  value,
  caption,
  icon,
  tone,
  progress,
  sparkline,
}: {
  eyebrow: string;
  label: string;
  value: number;
  caption: string;
  icon: IconName;
  tone: Tone;
  progress?: number;
  sparkline?: number[];
}) {
  return (
    <article className="bento-card group relative overflow-hidden p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-34px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-2xl ${TONE_STYLES[tone].icon}`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-right text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {eyebrow}
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs leading-5 text-slate-500">{caption}</p>
      {sparkline ? (
        <div className="mt-3">
          <Sparkline
            values={sparkline}
            height={38}
            color={tone === "violet" ? "#8b5cf6" : "#0891b2"}
            ariaLabel={`${label} sur la semaine`}
          />
        </div>
      ) : null}
      {progress !== undefined ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${TONE_STYLES[tone].solid}`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
      {children}
    </p>
  );
}

export default function BureauCockpit({
  canManageSite,
  canApproveCoachAbsences,
  coachAbsencePendingCount,
  memberRequestPendingCount,
  renewalCount,
  newsCount,
  galleryCount,
  disciplines,
  slots,
  applications,
  weekSchedule,
}: BureauCockpitProps) {
  const metrics = useMemo(() => {
    const steps: Record<DossierStep, number> = {
      new_request: 0,
      awaiting_espace: 0,
      missing_document: 0,
      awaiting_payment: 0,
      finalized: 0,
      rejected: 0,
      cancelled: 0,
    };
    let enCours = 0;
    let finalises = 0;
    let exclus = 0;

    for (const application of applications) {
      const step = getDossierStep(application);
      steps[step] += 1;
      if (step === "finalized") {
        finalises += 1;
      } else if (step === "rejected" || step === "cancelled") {
        exclus += 1;
      } else {
        enCours += 1;
      }
    }

    return {
      enCours,
      finalises,
      exclus,
      tous: applications.length,
      steps,
    };
  }, [applications]);

  const completionRate = Math.round(
    (metrics.finalises / Math.max(1, metrics.tous)) * 100,
  );

  const countsByDiscipline = useMemo(
    () =>
      disciplines
        .map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
          count: applications.filter((application) => {
            const disciplineIds =
              application.disciplineIds?.length
                ? application.disciplineIds
                : [application.disciplineId];
            return disciplineIds.includes(discipline.id);
          }).length,
        }))
        .sort((a, b) => b.count - a.count),
    [applications, disciplines],
  );

  const monthlySeries = useMemo(() => {
    const now = new Date();
    const series = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const rawLabel = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date);
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).replace(".", "");
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label,
        value: 0,
      };
    });
    const byKey = new Map(series.map((item) => [item.key, item]));

    for (const application of applications) {
      const created = new Date(application.createdAt);
      if (Number.isNaN(created.getTime())) continue;
      const bucket = byKey.get(`${created.getFullYear()}-${created.getMonth()}`);
      if (bucket) bucket.value += 1;
    }

    return series;
  }, [applications]);

  const monthlyTotal = monthlySeries.reduce((sum, item) => sum + item.value, 0);

  const weekSeries = useMemo(
    () =>
      TEACHING_DAYS.map((label, index) => {
        const entries = weekSchedule.filter((entry) => entry.dayOfWeek === index + 1);
        const cancelled = entries.filter((entry) => entry.cancelled).length;
        return {
          label,
          normal: entries.length - cancelled,
          cancelled,
          total: entries.length,
        };
      }),
    [weekSchedule],
  );

  const weekCancelled = weekSeries.reduce((sum, item) => sum + item.cancelled, 0);
  const weekActive = weekSchedule.filter((entry) => !entry.cancelled).length;
  const weekDisciplineCount = new Set(weekSchedule.map((entry) => entry.disciplineId)).size;

  const nextSessions = useMemo(
    () => weekSchedule.filter((entry) => !entry.cancelled).slice(0, 4),
    [weekSchedule],
  );

  const filterOptions: {
    id: QueueFilter;
    label: string;
    value: number;
  }[] = [
    { id: "en_cours", label: "En cours", value: metrics.enCours },
    { id: "finalized", label: "Finalisés", value: metrics.finalises },
    { id: "all", label: "Tous les dossiers", value: metrics.tous },
  ];

  const statusSegments = [
    { label: "En cours", value: metrics.enCours, color: "#f59e0b" },
    { label: "Finalisés", value: metrics.finalises, color: "#10b981" },
    { label: "Refusés / annulés", value: metrics.exclus, color: "#64748b" },
  ];

  const disciplineChartData = countsByDiscipline.map((item, index) => ({
    label: item.name,
    value: item.count,
    color: DISCIPLINE_COLORS[index % DISCIPLINE_COLORS.length],
  }));

  const weekChartData = weekSeries.map((item) => ({
    label: item.label,
    segments: [
      { value: item.normal, color: "#0891b2", label: "Séances" },
      { value: item.cancelled, color: "#fb7185", label: "Annulées" },
    ],
  }));

  const priorityItems: {
    label: string;
    value: number;
    tone: Tone;
    icon: IconName;
    href: string;
  }[] = [
    {
      label: "À examiner",
      value: metrics.steps.new_request + metrics.steps.awaiting_espace,
      tone: "cyan",
      icon: "sparkles",
      href: "/espace/bureau/dossiers?filtre=en_cours",
    },
    {
      label: "Pièces manquantes",
      value: metrics.steps.missing_document,
      tone: "rose",
      icon: "users",
      href: "/espace/bureau/dossiers?filtre=en_cours",
    },
    {
      label: "Paiements en attente",
      value: metrics.steps.awaiting_payment,
      tone: "amber",
      icon: "clock",
      href: "/espace/bureau/dossiers?filtre=en_cours",
    },
    ...(canApproveCoachAbsences
      ? [
          {
            label: "Absences coach",
            value: coachAbsencePendingCount,
            tone: "violet" as Tone,
            icon: "shield" as IconName,
            href: "/espace/bureau/planning#absences-coach",
          },
        ]
      : []),
  ];

  const toolCards: {
    eyebrow: string;
    title: string;
    description: string;
    href: string;
    icon: IconName;
    tone: Tone;
    stats: { label: string; value: number; alert?: boolean }[];
  }[] = [
    {
      eyebrow: "Inscriptions",
      title: "Dossiers",
      description:
        "File de traitement, validation des pièces et adhésions papier reçues au bureau.",
      href: "/espace/bureau/dossiers",
      icon: "users",
      tone: "cyan",
      stats: [
        { label: "À traiter", value: metrics.enCours, alert: metrics.enCours > 0 },
        { label: "Finalisés", value: metrics.finalises },
      ],
    },
    {
      eyebrow: "Semaine",
      title: "Essais & planning",
      description:
        "Créneaux d’essai, ajustements de séances et validation des absences coach.",
      href: "/espace/bureau/planning",
      icon: "calendar",
      tone: "violet",
      stats: [
        { label: "Créneaux d’essai", value: slots.length },
        {
          label: canApproveCoachAbsences ? "Absences à valider" : "Séances cette semaine",
          value: canApproveCoachAbsences ? coachAbsencePendingCount : weekSchedule.length,
          alert: canApproveCoachAbsences && coachAbsencePendingCount > 0,
        },
      ],
    },
    {
      eyebrow: "Échanges",
      title: "Communication",
      description: "Envoyez un e-mail à tous les adhérents, à une activité ou à une personne.",
      href: "/espace/bureau/communication",
      icon: "mail",
      tone: "emerald",
      stats: [
        { label: "Adhérents à jour", value: metrics.finalises },
        { label: "Activités", value: disciplines.length },
      ],
    },
    {
      eyebrow: "Support",
      title: "Adhérents",
      description: "Demandes envoyées depuis l’espace personnel et licences à renouveler.",
      href: "/espace/bureau/adherents",
      icon: "shield",
      tone: "amber",
      stats: [
        {
          label: "Demandes",
          value: memberRequestPendingCount,
          alert: memberRequestPendingCount > 0,
        },
        { label: "À renouveler", value: renewalCount, alert: renewalCount > 0 },
      ],
    },
    ...(canManageSite
      ? [
          {
            eyebrow: "Publication",
            title: "Contenu du site",
            description:
              "Actualités, galerie d’accueil et informations de l’association. Les anciennes actualités sont archivées.",
            href: "/espace/bureau/contenu",
            icon: "image" as IconName,
            tone: "slate" as Tone,
            stats: [
              { label: "Actualités", value: newsCount },
              { label: "Photos", value: galleryCount },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto mt-6 min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden px-4 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-700">
            Espace bureau
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Cockpit bureau
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {canManageSite
              ? "Vue d’ensemble des inscriptions, du planning et de la communication. Chaque outil s’ouvre sur sa propre page."
              : "Vue d’ensemble des pré-inscriptions, des essais et des e-mails. Chaque outil s’ouvre sur sa propre page."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Données à jour
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {metrics.enCours} à traiter
          </span>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-800/60 bg-slate-950 p-5 text-white shadow-[0_30px_80px_-42px_rgba(2,6,23,0.9)] sm:p-6 lg:col-span-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl"
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                  Vue d&apos;ensemble
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
                  Dossiers d&apos;adhésion
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/60">
                Temps réel
              </span>
            </div>

            <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
              <div className="h-40 w-40 shrink-0 sm:h-44 sm:w-44">
                <DonutChart
                  segments={statusSegments}
                  centerValue={metrics.enCours}
                  centerLabel="en cours"
                  ariaLabel={`${metrics.enCours} dossiers en cours, ${metrics.finalises} finalisés, ${metrics.exclus} refusés ou annulés`}
                />
              </div>
              <div className="w-full space-y-2">
                {filterOptions.map((option) => (
                  <Link
                    key={option.id}
                    href={`/espace/bureau/dossiers?filtre=${option.id}`}
                    className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-white/75 lg:text-xs xl:text-sm">
                      {option.label}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-white lg:text-xs xl:text-sm">
                      {option.value}
                      <Icon
                        name="arrow"
                        className="h-3.5 w-3.5 text-white/30 transition group-hover:text-white/70 lg:h-3 lg:w-3 xl:h-3.5 xl:w-3.5"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-medium text-white/60">
              {statusSegments.map((segment) => (
                <span key={segment.label} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  {segment.label} · {segment.value}
                </span>
              ))}
            </div>

            <p className="mt-auto pt-4 text-[11px] leading-5 text-white/50">
              Chaque ligne ouvre la file de traitement correspondante sur la page Dossiers.
            </p>
          </div>
        </section>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-span-7">
          <MetricCard
            eyebrow="Dossiers clos"
            label="Finalisés"
            value={metrics.finalises}
            caption={`${completionRate}% des dossiers traités`}
            icon="check"
            tone="emerald"
            progress={completionRate}
          />

          <article className="bento-card flex items-center gap-4 p-4">
            <RadialProgress value={completionRate} label="Taux de finalisation" />
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Qualité du suivi
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Taux de finalisation</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {metrics.finalises} sur {metrics.tous} dossiers finalisés.
              </p>
            </div>
          </article>

          <MetricCard
            eyebrow="Cette semaine"
            label="Séances au planning"
            value={weekSchedule.length}
            caption={
              weekCancelled > 0
                ? `${weekCancelled} séance(s) annulée(s)`
                : "Aucune annulation cette semaine"
            }
            icon="calendar"
            tone="cyan"
            sparkline={weekSeries.map((item) => item.normal)}
          />

          {canApproveCoachAbsences ? (
            <MetricCard
              eyebrow="À valider"
              label="Absences coach"
              value={coachAbsencePendingCount}
              caption={
                coachAbsencePendingCount > 0
                  ? "Demandes en attente de validation"
                  : "Tout est à jour"
              }
              icon="shield"
              tone="violet"
            />
          ) : (
            <MetricCard
              eyebrow="Catalogue"
              label="Activités actives"
              value={disciplines.length}
              caption="Disciplines proposées par l'association"
              icon="chart"
              tone="cyan"
            />
          )}
        </div>

        <section className="bento-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Activités
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Répartition des dossiers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Nombre de demandes par activité, toutes périodes confondues.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {disciplines.length} activités
            </span>
          </div>
          <div className="mt-5 max-h-64 overflow-y-auto pr-1">
            {disciplineChartData.length > 0 ? (
              <HorizontalBars
                data={disciplineChartData}
                ariaLabel="Nombre de dossiers par activité"
              />
            ) : (
              <EmptyState>Aucune activité configurée pour le moment.</EmptyState>
            )}
          </div>
        </section>

        <section className="bento-card p-5 sm:p-6 lg:col-span-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Tendance
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Rythme des inscriptions
              </h2>
              <p className="mt-1 text-sm text-slate-500">Dossiers reçus sur les 6 derniers mois.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {monthlyTotal} sur 6 mois
            </span>
          </div>
          <div className="mt-5">
            <BarChart
              data={monthlySeries}
              height={210}
              color="#0891b2"
              valueSuffix=" dossier(s)"
              ariaLabel={`Répartition mensuelle des inscriptions : ${monthlySeries
                .map((item) => `${item.label} ${item.value}`)
                .join(", ")}`}
            />
          </div>
        </section>

        <section className="bento-card flex h-full flex-col p-5 sm:p-6 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Planning
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Charge de la semaine
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Séances actives et annulations par jour.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-600" />
                Séances
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Annulées
              </span>
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)]">
            <div className="min-w-0">
              <StackedBarChart
                data={weekChartData}
                height={210}
                ariaLabel={`Séances de la semaine : ${weekSeries
                  .map((item) => `${item.label} ${item.total}`)
                  .join(", ")}`}
              />
              {weekSchedule.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Aucune séance programmée cette semaine.
                </p>
              ) : null}
            </div>

            <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Prochaines séances
              </p>
              {nextSessions.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {nextSessions.map((entry) => (
                    <li key={entry.id} className="flex min-w-0 gap-3">
                      <span className="w-10 shrink-0 text-xs font-semibold text-cyan-700">
                        {entry.startTime}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {entry.disciplineName}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                          {entry.dayLabel}
                          {entry.location ? ` · ${entry.location}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Aucune séance à venir sur la semaine en cours.
                </p>
              )}
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
            {[
              { label: "Séances actives", value: weekActive, tone: "text-cyan-700" },
              { label: "Annulées", value: weekCancelled, tone: "text-rose-600" },
              { label: "Activités", value: weekDisciplineCount, tone: "text-slate-900" },
              { label: "Créneaux d'essai", value: slots.length, tone: "text-slate-900" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50/80 px-3 py-2.5">
                <p className={`text-lg font-semibold tracking-tight ${item.tone}`}>{item.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bento-card p-5 sm:p-6 lg:col-span-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Priorités
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              À traiter maintenant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Les points qui demandent une action rapide.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {priorityItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-left transition hover:border-slate-200 hover:bg-white"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${TONE_STYLES[item.tone].icon}`}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-medium text-slate-700">{item.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-950">{item.value}</span>
                  <span className="text-slate-300 transition group-hover:text-slate-500">→</span>
                </span>
              </Link>
            ))}
          </div>

          {priorityItems.every((item) => item.value === 0) ? (
            <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
              Rien à traiter pour le moment.
            </p>
          ) : null}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Actions rapides
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/espace/bureau/communication"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-800"
              >
                <Icon name="mail" className="h-4 w-4 text-cyan-600" />
                Écrire un e-mail
              </Link>
              <Link
                href="/espace/bureau/dossiers#adherent-papier"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-800"
              >
                <Icon name="plus" className="h-4 w-4 text-cyan-600" />
                Adhérent papier
              </Link>
              <Link
                href="/espace/bureau/planning"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-800"
              >
                <Icon name="calendar" className="h-4 w-4 text-cyan-600" />
                Planning
              </Link>
              {canManageSite ? (
                <Link
                  href="/espace/bureau/contenu"
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-800"
                >
                  <Icon name="image" className="h-4 w-4 text-cyan-600" />
                  Contenu du site
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <section className="anchor-section space-y-4 pt-2">
        <SectionHeading
          eyebrow="Raccourcis"
          title="Outils du bureau"
          description="Chaque outil a sa propre page : le cockpit reste léger et les formulaires lourds sont à portée de clic."
        />

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {toolCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bento-card group flex min-w-0 flex-col p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-34px_rgba(15,23,42,0.45)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${TONE_STYLES[card.tone].icon}`}
                >
                  <Icon name={card.icon} className="h-5 w-5" />
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-cyan-200 group-hover:text-cyan-700">
                  <Icon name="arrow" className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {card.eyebrow}
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                {card.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{card.description}</p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                {card.stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-slate-50/80 px-3 py-2.5">
                    <p
                      className={`text-lg font-semibold tracking-tight ${
                        stat.alert ? "text-amber-600" : "text-slate-900"
                      }`}
                    >
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Astuce : les priorités et les actions rapides ci-dessus ouvrent directement la bonne page.
        </p>
      </section>
    </div>
  );
}
