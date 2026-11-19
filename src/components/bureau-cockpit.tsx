"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BarChart,
  DonutChart,
  HorizontalBars,
  RadialProgress,
  Sparkline,
} from "@/components/bureau-cockpit-charts";
import WeekCalendar from "@/components/bureau-week-calendar";
import type { RegistrationApplication } from "@/lib/club-data";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  getApplicationDisciplineIds,
  getDossierStep,
  type DossierStep,
} from "@/lib/dossier-workflow";
import type { DisciplineColor } from "@/lib/discipline-colors";
import { formatHourLabel } from "@/lib/public-site";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

type BureauCockpitProps = {
  canManageSite: boolean;
  canApproveCoachAbsences: boolean;
  coachAbsencePendingCount: number;
  memberRequestPendingCount: number;
  contactChangePendingCount: number;
  renewalCount: number;
  newsCount: number;
  galleryCount: number;
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
  weekSchedule: WeekScheduleEntry[];
  disciplineColors: Record<string, DisciplineColor>;
  upcomingSessions: WeekScheduleEntry[];
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
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
} as const;

type IconName = keyof typeof ICON_PATHS;

const TONE_STYLES = {
  blue: { icon: "bg-brand-blue/12 text-brand-blue", pill: "bg-brand-blue text-white" },
  green: { icon: "bg-brand-green/15 text-brand-green-dark", pill: "bg-brand-green text-white" },
  orange: { icon: "bg-amber-100 text-amber-800", pill: "bg-brand-orange text-amber-950" },
  rose: { icon: "bg-rose-100 text-rose-700", pill: "bg-rose-600 text-white" },
  violet: { icon: "bg-violet-100 text-violet-700", pill: "bg-violet-600 text-white" },
  slate: { icon: "bg-slate-100 text-slate-600", pill: "bg-slate-600 text-white" },
} as const;

type Tone = keyof typeof TONE_STYLES;

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

const TEACHING_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-brand-cream/60 px-4 py-6 text-sm text-slate-600">
      {children}
    </p>
  );
}

function CardTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="min-w-0">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

export default function BureauCockpit({
  canManageSite,
  canApproveCoachAbsences,
  coachAbsencePendingCount,
  memberRequestPendingCount,
  contactChangePendingCount,
  renewalCount,
  disciplines,
  applications,
  weekSchedule,
  disciplineColors,
  upcomingSessions,
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

    return { enCours, finalises, exclus, tous: applications.length, steps };
  }, [applications]);

  const completionRate = Math.round((metrics.finalises / Math.max(1, metrics.tous)) * 100);

  const countsByDiscipline = useMemo(
    () =>
      disciplines
        .map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
          // Effectif réel : un adhérent compte dans chacune de ses activités,
          // hors dossiers refusés ou désinscrits.
          count: applications.filter(
            (application) =>
              application.status !== "rejected" &&
              application.status !== "cancelled" &&
              getApplicationDisciplineIds(application).includes(discipline.id),
          ).length,
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
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label, value: 0 };
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
  const thisMonth = monthlySeries[monthlySeries.length - 1]?.value ?? 0;
  const lastMonth = monthlySeries[monthlySeries.length - 2]?.value ?? 0;

  const weekSeries = useMemo(
    () =>
      TEACHING_DAYS.map((label, index) => {
        const entries = weekSchedule.filter((entry) => entry.dayOfWeek === index + 1);
        return entries.filter((entry) => !entry.cancelled).length;
      }),
    [weekSchedule],
  );
  const weekCancelled = weekSchedule.filter((entry) => entry.cancelled).length;

  const statusSegments = [
    { label: "En cours", value: metrics.enCours, color: "#f5a524", href: "/espace/bureau/dossiers?filtre=en_cours" },
    { label: "Finalisés", value: metrics.finalises, color: "#2e9e4f", href: "/espace/bureau/dossiers?filtre=finalized" },
    { label: "Refusés ou désinscrits", value: metrics.exclus, color: "#94a3b8", href: "/espace/bureau/dossiers?filtre=refuses" },
  ];

  const disciplineChartData = countsByDiscipline.map((item, index) => ({
    label: item.name,
    value: item.count,
    color: disciplineColors[item.id]?.bg ?? ["#1f6fd0", "#2e9e4f", "#e23d86", "#f5a524", "#0e8f8a", "#7c5cc4"][index % 6],
  }));

  const priorityItems: { label: string; value: number; tone: Tone; icon: IconName; href: string }[] = [
    {
      label: "Dossiers à examiner",
      value: metrics.steps.new_request + metrics.steps.awaiting_espace,
      tone: "blue",
      icon: "sparkles",
      href: "/espace/bureau/dossiers?etape=a_examiner",
    },
    {
      label: "Pièces manquantes",
      value: metrics.steps.missing_document,
      tone: "rose",
      icon: "file",
      href: "/espace/bureau/dossiers?etape=pieces",
    },
    {
      label: "Paiements en attente",
      value: metrics.steps.awaiting_payment,
      tone: "orange",
      icon: "clock",
      href: "/espace/bureau/dossiers?etape=paiement",
    },
    {
      label: "Coordonnées à valider",
      value: contactChangePendingCount,
      tone: "blue",
      icon: "users",
      href: "/espace/bureau/dossiers",
    },
    {
      label: "Demandes des adhérents",
      value: memberRequestPendingCount,
      tone: "violet",
      icon: "chat",
      href: "/espace/bureau/adherents#demandes",
    },
    {
      label: "Licences à renouveler",
      value: renewalCount,
      tone: "orange",
      icon: "refresh",
      href: "/espace/bureau/adherents#renouvellements",
    },
    ...(canApproveCoachAbsences
      ? [
          {
            label: "Absences de coach à valider",
            value: coachAbsencePendingCount,
            tone: "violet" as Tone,
            icon: "shield" as IconName,
            href: "/espace/bureau/planning?onglet=absences",
          },
        ]
      : []),
  ];
  const nothingToDo = priorityItems.every((item) => item.value === 0);

  const tools: {
    title: string;
    description: string;
    href: string;
    icon: IconName;
    tone: Tone;
    badge?: number;
    badgeLabel?: string;
  }[] = [
    {
      title: "Dossiers",
      description: "Inscriptions, pièces, paiements, adhérents papier.",
      href: "/espace/bureau/dossiers",
      icon: "users",
      tone: "blue",
      badge: metrics.enCours,
      badgeLabel: "à traiter",
    },
    {
      title: "Planning",
      description: "Séances, annulations, essais et absences de coach.",
      href: "/espace/bureau/planning",
      icon: "calendar",
      tone: "violet",
      badge: canApproveCoachAbsences ? coachAbsencePendingCount : 0,
      badgeLabel: "absence(s)",
    },
    {
      title: "Communication",
      description: "Envoyer un e-mail à tous, à une activité ou à une personne.",
      href: "/espace/bureau/communication",
      icon: "mail",
      tone: "green",
    },
    {
      title: "Demandes",
      description: "Demandes des adhérents et licences à renouveler.",
      href: "/espace/bureau/adherents",
      icon: "chat",
      tone: "orange",
      badge: memberRequestPendingCount + renewalCount,
      badgeLabel: "à voir",
    },
    ...(canManageSite
      ? [
          {
            title: "Contenu du site",
            description: "Actualités, photos de l’accueil, informations de l’association.",
            href: "/espace/bureau/contenu",
            icon: "image" as IconName,
            tone: "slate" as Tone,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto mt-6 w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden px-4 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="eyebrow">Espace bureau</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Cockpit bureau</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600">
            Ce qui demande votre attention aujourd’hui, et l’essentiel de la vie de l’association.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/espace/bureau/dossiers#adherent-papier" className="btn btn-outline btn-sm">
            <Icon name="plus" className="h-4 w-4" />
            Adhérent papier
          </Link>
          <Link href="/espace/bureau/communication" className="btn btn-primary btn-sm">
            <Icon name="mail" className="h-4 w-4" />
            Écrire un e-mail
          </Link>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-brand-blue-dark p-5 text-white shadow-[0_30px_70px_-40px_rgba(20,64,127,0.9)] sm:p-6 lg:col-span-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-orange/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand-pink/20 blur-3xl"
          />
          <div className="relative flex h-full flex-col">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">Vue d’ensemble</span>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">Dossiers d’adhésion</h2>

            <div className="my-auto flex flex-col items-center gap-6 py-6 sm:flex-row lg:flex-col xl:flex-row">
              <div className="h-44 w-44 shrink-0">
                <DonutChart
                  segments={statusSegments}
                  centerValue={metrics.enCours}
                  centerLabel="en cours"
                  ariaLabel={`${metrics.enCours} dossiers en cours, ${metrics.finalises} finalisés, ${metrics.exclus} refusés ou désinscrits`}
                />
              </div>
              <div className="w-full space-y-2">
                {statusSegments.map((segment) => (
                  <Link
                    key={segment.label}
                    href={segment.href}
                    className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-3.5 py-2.5 text-sm transition hover:border-white/30 hover:bg-white/[0.14]"
                  >
                    <span className="flex items-center gap-2.5 text-white/90">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                      {segment.label}
                    </span>
                    <span className="flex items-center gap-2 font-extrabold text-white">
                      {segment.value}
                      <Icon name="arrow" className="h-3.5 w-3.5 text-white/40 transition group-hover:text-white" />
                    </span>
                  </Link>
                ))}
                <Link
                  href="/espace/bureau/dossiers?filtre=all"
                  className="block px-1 pt-1 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
                >
                  Voir les {metrics.tous} dossiers →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-4 lg:col-span-7">
          <section className="panel p-5 sm:p-6">
            <CardTitle eyebrow="Priorités" title="À traiter maintenant" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {priorityItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 transition hover:border-brand-blue/40 hover:bg-white ${
                    item.value > 0 ? "border-brand-line bg-brand-cream/70" : "border-brand-line/70 bg-white opacity-70"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_STYLES[item.tone].icon}`}
                    >
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                  </span>
                  <span
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-extrabold ${
                      item.value > 0 ? TONE_STYLES[item.tone].pill : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.value}
                  </span>
                </Link>
              ))}
            </div>
            {nothingToDo ? (
              <p className="mt-3 rounded-2xl bg-brand-green/12 px-4 py-3 text-sm font-semibold text-brand-green-dark">
                Rien à traiter pour le moment. Bravo !
              </p>
            ) : null}
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="panel p-4">
              <p className="text-sm font-bold text-slate-900">Dossiers finalisés</p>
              <div className="mt-2 flex items-center gap-3">
                <RadialProgress
                  value={completionRate}
                  label="Taux de dossiers finalisés"
                  size={96}
                  className="h-[88px] w-[88px] shrink-0"
                />
                <p className="text-sm leading-5 text-slate-600">
                  <span className="block text-2xl font-extrabold text-slate-900">{metrics.finalises}</span>
                  sur {metrics.tous}
                </p>
              </div>
            </article>

            <article className="panel p-4">
              <p className="text-sm font-bold text-slate-900">Séances cette semaine</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">{weekSchedule.length}</p>
              <p className="text-sm text-slate-600">
                {weekCancelled > 0 ? `dont ${weekCancelled} annulée${weekCancelled > 1 ? "s" : ""}` : "aucune annulation"}
              </p>
              <div className="mt-2">
                <Sparkline values={weekSeries} height={36} color="#1f6fd0" ariaLabel="Séances par jour sur la semaine" />
              </div>
            </article>

            <article className="panel p-4">
              <p className="text-sm font-bold text-slate-900">Reçus ce mois-ci</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">{thisMonth}</p>
              <p className="text-sm text-slate-600">
                {lastMonth} le mois dernier
              </p>
              <div className="mt-2">
                <Sparkline
                  values={monthlySeries.map((item) => item.value)}
                  height={36}
                  color="#2e9e4f"
                  ariaLabel="Dossiers reçus par mois"
                />
              </div>
            </article>
          </div>
        </div>

        <section className="panel p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle
              eyebrow="Activités"
              title="Adhérents par activité"
              description="Un adhérent compte dans chacune de ses activités (dossiers refusés ou désinscrits exclus)."
            />
            <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-bold text-brand-blue-dark">
              {disciplines.length} activités
            </span>
          </div>
          <div className="mt-5">
            {disciplineChartData.length > 0 ? (
              <HorizontalBars data={disciplineChartData} ariaLabel="Nombre d’adhérents par activité" />
            ) : (
              <EmptyState>Aucune activité configurée pour le moment.</EmptyState>
            )}
          </div>
        </section>

        <section className="panel p-5 sm:p-6 lg:col-span-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle eyebrow="Tendance" title="Rythme des inscriptions" description="Dossiers reçus sur les 6 derniers mois." />
            <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-bold text-brand-blue-dark">
              {monthlyTotal} sur 6 mois
            </span>
          </div>
          <div className="mt-5">
            <BarChart
              data={monthlySeries}
              height={210}
              color="#1f6fd0"
              valueSuffix=" dossier(s)"
              ariaLabel={`Répartition mensuelle des inscriptions : ${monthlySeries
                .map((item) => `${item.label} ${item.value}`)
                .join(", ")}`}
            />
          </div>
        </section>

        <section className="panel flex flex-col p-5 sm:p-6 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle
              eyebrow="Planning"
              title="La semaine en cours"
              description="Chaque séance est placée selon son horaire réel."
            />
            <Link href="/espace/bureau/planning" className="text-sm font-bold text-brand-blue hover:underline">
              Ouvrir le planning →
            </Link>
          </div>

          <div className="mt-5 min-w-0">
            <WeekCalendar
              entries={weekSchedule}
              colors={disciplineColors}
              ariaLabel={`Planning de la semaine : ${weekSchedule
                .map((entry) => `${entry.dayLabel} ${entry.startTime} ${entry.disciplineName}${entry.cancelled ? " annulée" : ""}`)
                .join(", ")}`}
            />
            {weekSchedule.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Aucune séance programmée cette semaine.</p>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl border border-brand-line bg-brand-cream/60 p-4">
            <p className="text-sm font-bold text-slate-900">Prochaines séances</p>
            {upcomingSessions.length > 0 ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {upcomingSessions.map((entry) => (
                  <li key={entry.id} className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: disciplineColors[entry.disciplineId]?.bg ?? "#1f6fd0" }}
                      aria-hidden
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-bold text-slate-900">{entry.disciplineName}</span>
                      <span className="block truncate text-slate-600">
                        {entry.dayLabel}, {formatHourLabel(entry.startTime)}
                        {entry.location ? ` · ${entry.location}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Aucune séance à venir pour le moment.</p>
            )}
          </div>
        </section>

        <section className="panel p-5 sm:p-6 lg:col-span-4">
          <CardTitle eyebrow="Raccourcis" title="Outils du bureau" />
          <div className="mt-4 space-y-2">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex items-center gap-3 rounded-2xl border border-brand-line bg-white px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-[0_14px_30px_-22px_rgba(20,64,127,0.6)]"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_STYLES[tool.tone].icon}`}>
                  <Icon name={tool.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
                    {tool.title}
                    {tool.badge ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE_STYLES[tool.tone].pill}`}>
                        {tool.badge} {tool.badgeLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-sm leading-5 text-slate-600">{tool.description}</span>
                </span>
                <Icon name="arrow" className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-brand-blue" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
