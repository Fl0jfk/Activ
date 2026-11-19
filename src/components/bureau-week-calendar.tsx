"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import PlanningModal from "@/components/planning-modal";
import { FALLBACK_DISCIPLINE_COLOR, buildDisciplineColors, type DisciplineColor } from "@/lib/discipline-colors";
import { formatHourLabel } from "@/lib/public-site";
import type { DayOfWeek } from "@/lib/schedule-constants";
import { addDaysToIsoDate, todayParisIso, type WeekScheduleEntry } from "@/lib/schedule-week";
import { buildPositionedEntries, hasUsableTime } from "@/lib/week-layout";

export type WeekCalendarEmptyTarget = {
  dayOfWeek: DayOfWeek;
  /** Heure cliquée, arrondie à la demi-heure (HH:MM). */
  startTime: string;
};

type WeekCalendarProps = {
  entries: WeekScheduleEntry[];
  ariaLabel: string;
  /** Couleurs par discipline ; à défaut, calculées à partir des disciplines présentes. */
  colors?: Record<string, DisciplineColor>;
  /** Clic sur une séance. Sans cette fonction, une fiche de lecture s'ouvre. */
  onSelect?: (entry: WeekScheduleEntry) => void;
  /** Clic sur une zone vide du calendrier (ex. pour ajouter un créneau). */
  onSelectEmpty?: (target: WeekCalendarEmptyTarget) => void;
  selectedId?: string;
  compact?: boolean;
  weekLabel?: string;
  /** Lundi de la semaine (YYYY-MM-DD), pour afficher les dates en en-tête. */
  weekStartIso?: string;
  /** Aujourd'hui (YYYY-MM-DD, Paris). À défaut, calculé côté navigateur à l'heure de Paris. */
  todayIso?: string;
};

const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LANE_WEIGHTS = [1, 1, 1.5, 2.2, 3];
const CANCELLED_STYLE =
  "border border-dashed border-rose-300 bg-[repeating-linear-gradient(45deg,#fff,#fff_6px,#fdecef_6px,#fdecef_12px)] text-rose-700";

function subscribeNothing() {
  return () => {};
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function entryTimeLabel(entry: Pick<WeekScheduleEntry, "startTime" | "endTime">): string {
  const start = entry.startTime ? formatHourLabel(entry.startTime) : "";
  const end = entry.endTime ? formatHourLabel(entry.endTime) : "";
  if (!start && !end) return "Horaire à préciser";
  return start && end ? `${start} – ${end}` : start || end;
}

function entryLabel(entry: WeekScheduleEntry): string {
  return `${entry.disciplineName}, ${entry.dayLabel}, ${entryTimeLabel(entry)}${entry.cancelled ? ", annulée" : ""}`;
}

export default function WeekCalendar({
  entries,
  ariaLabel,
  colors,
  onSelect,
  onSelectEmpty,
  selectedId,
  compact = false,
  weekLabel,
  weekStartIso,
  todayIso,
}: WeekCalendarProps) {
  const [detail, setDetail] = useState<WeekScheduleEntry | null>(null);
  const clientToday = useSyncExternalStore(subscribeNothing, () => todayParisIso(), () => "");
  const today = todayIso ?? clientToday;
  const hourHeight = compact ? 44 : 52;

  const palette = useMemo(() => {
    if (colors) return colors;
    const ids = Array.from(new Set(entries.map((entry) => entry.disciplineId))).sort();
    return buildDisciplineColors(ids.map((id) => ({ id })));
  }, [colors, entries]);

  const timed = useMemo(() => entries.filter(hasUsableTime), [entries]);
  const untimed = useMemo(() => entries.filter((entry) => !hasUsableTime(entry)), [entries]);
  const positioned = useMemo(() => buildPositionedEntries(timed), [timed]);

  const { firstHour, lastHour } = useMemo(() => {
    const minHours = compact ? 6 : 10;
    if (positioned.length === 0) {
      return { firstHour: 9, lastHour: 9 + minHours };
    }
    let first = Math.floor(Math.min(...positioned.map((entry) => entry.startMin)) / 60);
    let last = Math.ceil(Math.max(...positioned.map((entry) => entry.endMin)) / 60);
    if (!compact) {
      first = Math.min(first, 9);
      last = Math.max(last, 19);
    }
    first = Math.max(0, first);
    last = Math.min(24, Math.max(last, first + minHours));
    return { firstHour: first, lastHour: last };
  }, [positioned, compact]);

  const firstEntry = entries[0];
  const mondayIso =
    weekStartIso ?? (firstEntry ? addDaysToIsoDate(firstEntry.date, -(firstEntry.dayOfWeek - 1)) : "");
  const dayDates = Array.from({ length: 7 }, (_, index) =>
    mondayIso ? addDaysToIsoDate(mondayIso, index) : "",
  );

  const gridHeight = (lastHour - firstHour) * hourHeight;
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  const dayWeights = Array.from({ length: 7 }, (_, index) => {
    const maxLanes = Math.max(
      1,
      ...positioned.filter((entry) => entry.dayOfWeek === index + 1).map((entry) => entry.lanes),
    );
    return LANE_WEIGHTS[Math.min(maxLanes, LANE_WEIGHTS.length - 1)]!;
  });
  const gridTemplateColumns = `52px ${dayWeights.map((weight) => `minmax(0, ${weight}fr)`).join(" ")}`;

  function select(entry: WeekScheduleEntry) {
    if (onSelect) onSelect(entry);
    else setDetail(entry);
  }

  function colorOf(entry: WeekScheduleEntry): DisciplineColor {
    return palette[entry.disciplineId] ?? FALLBACK_DISCIPLINE_COLOR;
  }

  const entriesByDay = Array.from({ length: 7 }, (_, index) =>
    entries.filter((entry) => entry.dayOfWeek === index + 1),
  );
  const detailColor = detail ? colorOf(detail) : FALLBACK_DISCIPLINE_COLOR;

  return (
    <div className="min-w-0" role="group" aria-label={ariaLabel}>
      {weekLabel ? <p className="mb-2 text-sm font-bold text-slate-800">{weekLabel}</p> : null}

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-brand-cream/60 px-4 py-6 text-center text-sm text-slate-600">
          Aucune séance prévue sur cette semaine.
        </p>
      ) : null}

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-2xl border border-brand-line bg-white p-3">
          <div className="min-w-[760px]">
            <div className="grid" style={{ gridTemplateColumns }}>
              <div />
              {DAY_SHORT.map((label, index) => {
                const date = dayDates[index]!;
                const isToday = Boolean(date) && date === today;
                return (
                  <div key={label} className="border-b border-brand-line pb-2 text-center">
                    <p
                      className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-brand-blue" : "text-slate-600"}`}
                    >
                      {label}
                    </p>
                    {date && !compact ? (
                      <p
                        className={`mx-auto mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-lg font-extrabold ${
                          isToday ? "bg-brand-blue text-white" : "text-slate-900"
                        }`}
                      >
                        {Number(date.slice(8, 10))}
                        {isToday ? <span className="sr-only"> (aujourd’hui)</span> : null}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((hour) => (
                  <span
                    key={hour}
                    aria-hidden="true"
                    className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-slate-500"
                    style={{ top: (hour - firstHour) * hourHeight }}
                  >
                    {hour} h
                  </span>
                ))}
              </div>

              {dayDates.map((date, dayIndex) => {
                const isToday = Boolean(date) && date === today;
                return (
                  <div
                    key={DAY_SHORT[dayIndex]}
                    className={`relative border-l border-brand-line ${isToday ? "bg-brand-blue/5" : ""} ${
                      onSelectEmpty ? "cursor-cell" : ""
                    }`}
                    style={{
                      height: gridHeight,
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight - 1}px, #e8e2d8 ${hourHeight - 1}px, #e8e2d8 ${hourHeight}px)`,
                    }}
                    onClick={
                      onSelectEmpty
                        ? (event) => {
                            if (event.target !== event.currentTarget) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            const minutes = firstHour * 60 + ((event.clientY - rect.top) / hourHeight) * 60;
                            const rounded = Math.min(23 * 60 + 30, Math.max(0, Math.floor(minutes / 30) * 30));
                            onSelectEmpty({
                              dayOfWeek: (dayIndex + 1) as DayOfWeek,
                              startTime: `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`,
                            });
                          }
                        : undefined
                    }
                  >
                    {positioned
                      .filter((entry) => entry.dayOfWeek === dayIndex + 1)
                      .map((entry) => {
                        const color = colorOf(entry);
                        const top = ((entry.startMin - firstHour * 60) / 60) * hourHeight;
                        const height = Math.max(((entry.endMin - entry.startMin) / 60) * hourHeight - 2, 30);
                        const width = 100 / entry.lanes;
                        const showTime = height >= 46 && entry.lanes < 3;
                        const selected = selectedId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => select(entry)}
                            aria-label={entryLabel(entry)}
                            aria-haspopup="dialog"
                            className={`absolute overflow-hidden rounded-xl px-2 py-1 text-left text-xs leading-tight transition hover:z-10 hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                              entry.cancelled ? CANCELLED_STYLE : "shadow-[0_6px_14px_-8px_rgba(0,0,0,0.4)]"
                            } ${selected ? "z-10 ring-2 ring-slate-900 ring-offset-1" : ""}`}
                            style={{
                              top,
                              height,
                              left: `calc(${entry.lane * width}% + 2px)`,
                              width: `calc(${width}% - 4px)`,
                              ...(entry.cancelled ? {} : { backgroundColor: color.bg, color: color.fg }),
                            }}
                          >
                            <span className={`block truncate font-bold ${entry.cancelled ? "line-through" : ""}`}>
                              {entry.disciplineName}
                            </span>
                            {showTime ? (
                              <span className="block truncate opacity-90">
                                {entry.cancelled ? "Annulée" : entryTimeLabel(entry)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {untimed.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
                <span className="text-sm font-bold text-slate-700">Sans horaire précis :</span>
                {untimed.map((entry) => {
                  const color = colorOf(entry);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => select(entry)}
                      aria-haspopup="dialog"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-slate-900"
                      style={{ backgroundColor: color.soft }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.bg }} />
                      {entry.dayLabel} · {entry.disciplineName}
                      {entry.cancelled ? " (annulée)" : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {entriesByDay.map((dayEntries, index) => {
          if (dayEntries.length === 0) return null;
          const date = dayDates[index]!;
          const isToday = Boolean(date) && date === today;
          return (
            <section key={DAY_SHORT[index]} className="rounded-2xl border border-brand-line bg-white px-4 py-3">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                {dayEntries[0]!.dayLabel}
                {isToday ? (
                  <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-xs font-bold text-white">
                    Aujourd’hui
                  </span>
                ) : null}
              </h3>
              <ul className="mt-2 divide-y divide-brand-line">
                {dayEntries.map((entry) => {
                  const color = colorOf(entry);
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => select(entry)}
                        aria-haspopup="dialog"
                        aria-label={entryLabel(entry)}
                        className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          aria-hidden="true"
                          className="w-2 self-stretch rounded-full"
                          style={{ backgroundColor: entry.cancelled ? "#e58a9a" : color.bg }}
                        />
                        <span
                          className={`min-w-[7.5rem] text-sm font-extrabold tabular-nums ${
                            entry.cancelled ? "text-rose-700 line-through" : "text-slate-900"
                          }`}
                        >
                          {entryTimeLabel(entry)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-semibold ${
                              entry.cancelled ? "text-rose-700 line-through" : "text-slate-900"
                            }`}
                          >
                            {entry.disciplineName}
                          </span>
                          <span className="block truncate text-xs text-slate-600">
                            {[entry.teacherName, entry.location].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {entry.cancelled ? (
                          <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">
                            Annulée
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {!onSelect ? (
        <PlanningModal
          open={detail !== null}
          title={detail?.disciplineName ?? ""}
          subtitle={detail?.dayLabel}
          accent={
            detail
              ? detail.cancelled
                ? { bg: "#fdecef", fg: "#b4233f" }
                : { bg: detailColor.bg, fg: detailColor.fg }
              : undefined
          }
          onClose={() => setDetail(null)}
        >
          {detail ? (
            <div>
              <dl className="space-y-3 text-[15px]">
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 font-bold text-slate-600">Horaire</dt>
                  <dd className="font-semibold text-slate-900">{entryTimeLabel(detail)}</dd>
                </div>
                {detail.location ? (
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 font-bold text-slate-600">Lieu</dt>
                    <dd className="text-slate-800">{detail.location}</dd>
                  </div>
                ) : null}
                {detail.teacherName ? (
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 font-bold text-slate-600">Coach</dt>
                    <dd className="text-slate-800">{detail.teacherName}</dd>
                  </div>
                ) : null}
              </dl>
              {detail.cancelled ? (
                <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-rose-800">
                  <p className="font-bold">Séance annulée</p>
                  {detail.cancelReason ? <p className="text-sm">{detail.cancelReason}</p> : null}
                </div>
              ) : null}
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => setDetail(null)} className="btn btn-ghost btn-sm">
                  Fermer
                </button>
              </div>
            </div>
          ) : null}
        </PlanningModal>
      ) : null}
    </div>
  );
}
