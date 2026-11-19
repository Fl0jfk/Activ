"use client";

import { useMemo, useState } from "react";
import WeekCalendar, { type WeekCalendarEmptyTarget } from "@/components/bureau-week-calendar";
import { EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import PlanningModal from "@/components/planning-modal";
import PlanningSessionDialog from "@/components/planning-session-dialog";
import PlanningSlotForm from "@/components/planning-slot-form";
import { FALLBACK_DISCIPLINE_COLOR, buildDisciplineColors } from "@/lib/discipline-colors";
import type { PlanningDiscipline, PlanningWeek } from "@/lib/planning-types";

type PlanningWeekViewProps = {
  weeks: PlanningWeek[];
  /** Disciplines dans l'ordre enregistré (les couleurs sont celles du planning public). */
  disciplines: PlanningDiscipline[];
  /** Aujourd'hui à Paris (YYYY-MM-DD), calculé sur le serveur. */
  todayIso: string;
  /** Président : peut ajouter et supprimer des créneaux. */
  canManageSlots: boolean;
  /** Adhérents approuvés par discipline. */
  memberCounts: Record<string, number>;
  teacherSuggestions: string[];
  slotCount: number;
  /** Renseigné pendant la fermeture estivale : la 1re semaine affichée est celle de la reprise. */
  summerNotice?: string;
};

type AddState = { key: number; defaults?: { dayOfWeek?: WeekCalendarEmptyTarget["dayOfWeek"]; startTime?: string } };

export default function PlanningWeekView({
  weeks,
  disciplines,
  todayIso,
  canManageSlots,
  memberCounts,
  teacherSuggestions,
  slotCount,
  summerNotice,
}: PlanningWeekViewProps) {
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addState, setAddState] = useState<AddState | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const colors = useMemo(() => buildDisciplineColors(disciplines), [disciplines]);
  const week = weeks[Math.min(weekIndex, weeks.length - 1)];
  const selectedEntry = week?.entries.find((entry) => entry.id === selectedId) ?? null;

  const legend = useMemo(() => {
    const ids = new Set((week?.entries ?? []).map((entry) => entry.disciplineId));
    return disciplines.filter((discipline) => ids.has(discipline.id));
  }, [week, disciplines]);

  if (!week) {
    return <EmptyState>Le planning n’est pas disponible pour le moment.</EmptyState>;
  }

  function openAdd(defaults?: AddState["defaults"]) {
    setFeedback(null);
    setAddState((current) => ({ key: (current?.key ?? 0) + 1, defaults }));
  }

  const firstWeekLabel = summerNotice ? "Semaine de reprise" : "Cette semaine";

  return (
    <SectionCard
      title="Séances de la semaine"
      description={
        canManageSlots
          ? "Cliquez sur une séance pour l’annuler ou la rétablir. Cliquez sur une zone vide du calendrier, ou sur le bouton, pour ajouter un créneau."
          : "Cliquez sur une séance pour l’annuler ou la rétablir."
      }
      action={
        canManageSlots ? (
          <button type="button" onClick={() => openAdd()} className="btn btn-primary btn-sm">
            + Ajouter un créneau
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {summerNotice ? <StatusMessage feedback={{ tone: "info", text: summerNotice }} /> : null}
        <StatusMessage feedback={feedback} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekIndex((index) => Math.max(0, index - 1))}
            disabled={weekIndex === 0}
            aria-label="Semaine précédente"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-xl font-bold text-slate-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
          >
            ‹
          </button>
          <p className="min-w-[14rem] text-center text-base font-bold text-slate-900" aria-live="polite">
            {week.label}
          </p>
          <button
            type="button"
            onClick={() => setWeekIndex((index) => Math.min(weeks.length - 1, index + 1))}
            disabled={weekIndex >= weeks.length - 1}
            aria-label="Semaine suivante"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-xl font-bold text-slate-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
          >
            ›
          </button>
          {weekIndex > 0 ? (
            <button
              type="button"
              onClick={() => setWeekIndex(0)}
              className="ml-1 min-h-10 px-2 text-sm font-semibold text-brand-blue hover:underline"
            >
              {firstWeekLabel}
            </button>
          ) : null}
        </div>

        {legend.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Légende des activités">
            {legend.map((discipline) => {
              const color = colors[discipline.id] ?? FALLBACK_DISCIPLINE_COLOR;
              return (
                <li
                  key={discipline.id}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-slate-900"
                  style={{ backgroundColor: color.soft }}
                >
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.bg }} />
                  {discipline.name}
                </li>
              );
            })}
          </ul>
        ) : null}

        {slotCount === 0 ? (
          <EmptyState>
            Aucun créneau n’est encore au planning.
            {canManageSlots ? " Utilisez le bouton « Ajouter un créneau » pour commencer." : ""}
          </EmptyState>
        ) : (
          <WeekCalendar
            entries={week.entries}
            ariaLabel={`Séances de la semaine, ${week.label}`}
            colors={colors}
            onSelect={(entry) => {
              setFeedback(null);
              setSelectedId(entry.id);
            }}
            onSelectEmpty={
              canManageSlots
                ? (target) => openAdd({ dayOfWeek: target.dayOfWeek, startTime: target.startTime })
                : undefined
            }
            selectedId={selectedId ?? undefined}
            weekStartIso={week.startIso}
            todayIso={todayIso}
          />
        )}
      </div>

      <PlanningSessionDialog
        entry={selectedEntry}
        color={selectedEntry ? (colors[selectedEntry.disciplineId] ?? FALLBACK_DISCIPLINE_COLOR) : FALLBACK_DISCIPLINE_COLOR}
        todayIso={todayIso}
        canManageSlots={canManageSlots}
        memberCount={selectedEntry ? (memberCounts[selectedEntry.disciplineId] ?? 0) : 0}
        onClose={() => setSelectedId(null)}
        onFeedback={setFeedback}
      />

      {canManageSlots ? (
        <PlanningModal
          open={addState !== null}
          title="Ajouter un créneau"
          subtitle="Planning"
          onClose={() => setAddState(null)}
        >
          {addState ? (
            <PlanningSlotForm
              key={addState.key}
              disciplines={disciplines}
              teacherSuggestions={teacherSuggestions}
              defaults={addState.defaults}
              onCancel={() => setAddState(null)}
              onDone={(message) => {
                setAddState(null);
                setFeedback({ tone: "success", text: message });
              }}
            />
          ) : null}
        </PlanningModal>
      ) : null}
    </SectionCard>
  );
}
