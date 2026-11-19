"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DisciplineColor } from "@/lib/discipline-colors";
import { FALLBACK_DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import { formatHourLabel } from "@/lib/public-site";
import { addDaysToIsoDate, type WeekScheduleEntry } from "@/lib/schedule-week";
import { buildPositionedEntries, hasUsableTime } from "@/lib/week-layout";

export type PlannerWeek = {
  startIso: string;
  label: string;
  entries: WeekScheduleEntry[];
};

export type PlannerDiscipline = {
  id: string;
  name: string;
  slug: string;
  color: DisciplineColor;
};

type WeekPlannerProps = {
  weeks: PlannerWeek[];
  disciplines: PlannerDiscipline[];
  todayIso: string;
};

const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_HEIGHT = 56;

function timeLabel(entry: WeekScheduleEntry): string {
  if (!hasUsableTime(entry)) return "Horaire à préciser";
  const start = entry.startTime ? formatHourLabel(entry.startTime) : "";
  const end = entry.endTime ? formatHourLabel(entry.endTime) : "";
  return start && end ? `${start} – ${end}` : start || end;
}

function dayNumber(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

export default function WeekPlanner({ weeks, disciplines, todayIso }: WeekPlannerProps) {
  const [weekIndex, setWeekIndex] = useState(0);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<WeekScheduleEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const disciplineById = useMemo(() => new Map(disciplines.map((item) => [item.id, item])), [disciplines]);
  const week = weeks[weekIndex] ?? weeks[0];

  const usedDisciplineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of weeks) for (const entry of item.entries) ids.add(entry.disciplineId);
    return ids;
  }, [weeks]);
  const filterOptions = disciplines.filter((item) => usedDisciplineIds.has(item.id));

  const visibleEntries = useMemo(
    () => (week ? week.entries.filter((entry) => activeIds.length === 0 || activeIds.includes(entry.disciplineId)) : []),
    [week, activeIds],
  );

  const timedPositioned = useMemo(
    () => buildPositionedEntries(visibleEntries.filter(hasUsableTime)),
    [visibleEntries],
  );
  const untimed = visibleEntries.filter((entry) => !hasUsableTime(entry));

  const { firstHour, lastHour } = useMemo(() => {
    const all = buildPositionedEntries((week?.entries ?? []).filter(hasUsableTime));
    if (all.length === 0) return { firstHour: 9, lastHour: 21 };
    const first = Math.max(0, Math.floor(Math.min(...all.map((entry) => entry.startMin)) / 60));
    const last = Math.min(24, Math.ceil(Math.max(...all.map((entry) => entry.endMin)) / 60));
    return { firstHour: first, lastHour: Math.max(last, first + 4) };
  }, [week]);

  useEffect(() => {
    if (selected) dialogRef.current?.showModal();
  }, [selected]);

  if (!week) return null;

  const LANE_WEIGHTS = [1, 1, 1.5, 2.2, 3];
  const dayWeights = Array.from({ length: 7 }, (_, index) => {
    const maxLanes = Math.max(1, ...timedPositioned.filter((entry) => entry.dayOfWeek === index + 1).map((entry) => entry.lanes));
    return LANE_WEIGHTS[Math.min(maxLanes, LANE_WEIGHTS.length - 1)]!;
  });
  const gridTemplateColumns = `48px ${dayWeights.map((weight) => `minmax(0, ${weight}fr)`).join(" ")}`;
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  const gridHeight = (lastHour - firstHour) * HOUR_HEIGHT;
  const dayDates = Array.from({ length: 7 }, (_, index) => addDaysToIsoDate(week.startIso, index));

  function toggleFilter(id: string) {
    setActiveIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const entriesByDate = new Map<string, WeekScheduleEntry[]>();
  for (const entry of visibleEntries) {
    const list = entriesByDate.get(entry.date) ?? [];
    list.push(entry);
    entriesByDate.set(entry.date, list);
  }
  const listDays = dayDates.filter((date) => entriesByDate.has(date));

  const selectedDiscipline = selected ? disciplineById.get(selected.disciplineId) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekIndex((index) => Math.max(0, index - 1))}
            disabled={weekIndex === 0}
            aria-label="Semaine précédente"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-line bg-white text-lg font-bold text-slate-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
          >
            ‹
          </button>
          <p className="min-w-[10rem] text-center text-sm font-bold text-slate-800 sm:text-base" aria-live="polite">
            {week.label}
          </p>
          <button
            type="button"
            onClick={() => setWeekIndex((index) => Math.min(weeks.length - 1, index + 1))}
            disabled={weekIndex >= weeks.length - 1}
            aria-label="Semaine suivante"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-line bg-white text-lg font-bold text-slate-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
          >
            ›
          </button>
          {weekIndex > 0 ? (
            <button
              type="button"
              onClick={() => setWeekIndex(0)}
              className="ml-1 text-sm font-semibold text-brand-blue hover:underline"
            >
              Cette semaine
            </button>
          ) : null}
        </div>

        <div className="hidden rounded-full border border-brand-line bg-white p-1 md:inline-flex" role="group" aria-label="Affichage">
          {(
            [
              ["grid", "Calendrier"],
              ["list", "Liste"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-pressed={view === value}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                view === value ? "bg-brand-blue text-white" : "text-slate-600 hover:text-brand-blue"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filterOptions.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par discipline">
          <button
            type="button"
            onClick={() => setActiveIds([])}
            aria-pressed={activeIds.length === 0}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
              activeIds.length === 0
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-brand-line bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            Toutes
          </button>
          {filterOptions.map((item) => {
            const active = activeIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleFilter(item.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                  active ? "text-slate-900" : "border-brand-line bg-white text-slate-700 hover:border-slate-400"
                }`}
                style={active ? { borderColor: item.color.bg, backgroundColor: item.color.soft } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color.bg }} />
                {item.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {visibleEntries.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-brand-line bg-white px-5 py-8 text-center text-slate-600">
          Aucune séance prévue sur cette semaine{activeIds.length > 0 ? " pour cette sélection" : ""}.
        </p>
      ) : null}

      {visibleEntries.length > 0 && view === "grid" ? (
        <div className="mt-5 hidden rounded-3xl border border-brand-line bg-white p-4 md:block">
          <div className="grid" style={{ gridTemplateColumns }}>
            <div />
            {dayDates.map((date, index) => {
              const today = date === todayIso;
              return (
                <div key={date} className="border-b border-brand-line pb-2 text-center">
                  <p className={`text-xs font-bold uppercase tracking-wide ${today ? "text-brand-blue" : "text-slate-500"}`}>
                    {DAY_SHORT[index]}
                  </p>
                  <p
                    className={`mx-auto mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-lg font-extrabold ${
                      today ? "bg-brand-blue text-white" : "text-slate-900"
                    }`}
                  >
                    {dayNumber(date)}
                  </p>
                </div>
              );
            })}

            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400"
                  style={{ top: (hour - firstHour) * HOUR_HEIGHT }}
                >
                  {hour} h
                </span>
              ))}
            </div>

            {dayDates.map((date, dayIndex) => (
              <div
                key={date}
                className="relative border-l border-brand-line"
                style={{
                  height: gridHeight,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, #e8e2d8 ${HOUR_HEIGHT - 1}px, #e8e2d8 ${HOUR_HEIGHT}px)`,
                }}
              >
                {timedPositioned
                  .filter((entry) => entry.dayOfWeek === dayIndex + 1)
                  .map((entry) => {
                    const color = disciplineById.get(entry.disciplineId)?.color ?? FALLBACK_DISCIPLINE_COLOR;
                    const top = ((entry.startMin - firstHour * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(((entry.endMin - entry.startMin) / 60) * HOUR_HEIGHT - 2, 28);
                    const width = 100 / entry.lanes;
                    const compact = entry.lanes >= 3 || height < 44;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelected(entry)}
                        aria-label={`${entry.disciplineName}, ${entry.dayLabel}, ${timeLabel(entry)}${entry.cancelled ? ", annulé" : ""}`}
                        className={`absolute overflow-hidden rounded-xl px-2 py-1.5 text-left text-xs leading-tight transition hover:z-10 hover:brightness-95 ${
                          entry.cancelled
                            ? "border border-dashed border-rose-300 bg-[repeating-linear-gradient(45deg,#fff,#fff_6px,#fdecef_6px,#fdecef_12px)] text-rose-700"
                            : "shadow-[0_6px_14px_-8px_rgba(0,0,0,0.4)]"
                        }`}
                        style={{
                          top,
                          height,
                          left: `calc(${entry.lane * width}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                          ...(entry.cancelled ? {} : { backgroundColor: color.bg, color: color.fg }),
                        }}
                      >
                        <span className={`block truncate text-[13px] font-bold ${entry.cancelled ? "line-through" : ""}`}>
                          {entry.disciplineName}
                        </span>
                        {!compact ? (
                          <span className="block truncate text-[11px] opacity-90">
                            {entry.cancelled ? "Annulé" : timeLabel(entry)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>

          {untimed.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
              <span className="text-sm font-bold text-slate-700">Sans horaire précis :</span>
              {untimed.map((entry) => {
                const color = disciplineById.get(entry.disciplineId)?.color ?? FALLBACK_DISCIPLINE_COLOR;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelected(entry)}
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-900"
                    style={{ backgroundColor: color.soft }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.bg }} />
                    {entry.dayLabel} · {entry.disciplineName}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleEntries.length > 0 ? (
        <div className={`mt-5 space-y-3 ${view === "grid" ? "md:hidden" : ""}`}>
          {listDays.map((date) => (
            <section key={date} className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 sm:px-5">
              <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-slate-900">
                {entriesByDate.get(date)![0]!.dayLabel}
                {date === todayIso ? (
                  <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-xs font-bold text-white">Aujourd&apos;hui</span>
                ) : null}
              </h3>
              <ul className="mt-2 divide-y divide-brand-line">
                {entriesByDate.get(date)!.map((entry) => {
                  const color = disciplineById.get(entry.disciplineId)?.color ?? FALLBACK_DISCIPLINE_COLOR;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(entry)}
                        className="flex w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          className="w-2 self-stretch rounded-full"
                          style={{ backgroundColor: entry.cancelled ? "#e58a9a" : color.bg }}
                        />
                        <span className={`min-w-[7.5rem] text-sm font-extrabold tabular-nums ${entry.cancelled ? "text-rose-700 line-through" : "text-slate-900"}`}>
                          {timeLabel(entry)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-semibold ${entry.cancelled ? "text-rose-700 line-through" : "text-slate-900"}`}>
                            {entry.disciplineName}
                          </span>
                          <span className="block truncate text-sm text-slate-500">
                            {[entry.teacherName, entry.location].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {entry.cancelled ? (
                          <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">Annulé</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label="Détail de la séance"
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-[min(420px,94vw)] overflow-hidden rounded-3xl border-0 p-0 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)] backdrop:bg-slate-900/50"
      >
        {selected ? (
          <div>
            <div
              className="px-6 py-5"
              style={{
                backgroundColor: selected.cancelled ? "#fdecef" : (selectedDiscipline?.color.bg ?? FALLBACK_DISCIPLINE_COLOR.bg),
                color: selected.cancelled ? "#b4233f" : (selectedDiscipline?.color.fg ?? "#fff"),
              }}
            >
              <p className="text-sm font-semibold opacity-90">{selected.dayLabel}</p>
              <p className="mt-0.5 text-2xl font-extrabold leading-tight">{selected.disciplineName}</p>
            </div>
            <dl className="space-y-3 px-6 py-5 text-[15px]">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 font-bold text-slate-500">Horaire</dt>
                <dd className="font-semibold text-slate-900">{timeLabel(selected)}</dd>
              </div>
              {selected.location ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 font-bold text-slate-500">Lieu</dt>
                  <dd className="text-slate-800">{selected.location}</dd>
                </div>
              ) : null}
              {selected.teacherName ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 font-bold text-slate-500">Coach</dt>
                  <dd className="text-slate-800">{selected.teacherName}</dd>
                </div>
              ) : null}
              {selected.cancelled ? (
                <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-rose-800">
                  <p className="font-bold">Séance annulée</p>
                  {selected.cancelReason ? <p className="text-sm">{selected.cancelReason}</p> : null}
                </div>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2 px-6 pb-6">
              {selectedDiscipline ? (
                <>
                  <Link href={`/disciplines/${selectedDiscipline.slug}`} className="btn btn-outline btn-sm">
                    Découvrir la discipline
                  </Link>
                  <Link href={`/preinscription?discipline=${selectedDiscipline.slug}`} className="btn btn-primary btn-sm">
                    Je me pré-inscris
                  </Link>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="btn btn-sm border-brand-line text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
