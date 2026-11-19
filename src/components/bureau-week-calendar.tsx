"use client";

import type { WeekScheduleEntry } from "@/lib/schedule-week";
import { buildPositionedEntries } from "@/lib/week-layout";

type WeekCalendarProps = {
  entries: WeekScheduleEntry[];
  ariaLabel: string;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const DISCIPLINE_COLORS = [
  "#0e7490",
  "#0f766e",
  "#4338ca",
  "#7e22ce",
  "#b45309",
  "#be123c",
  "#1d4ed8",
  "#047857",
];

function colorFor(disciplineId: string): string {
  let hash = 0;
  for (let index = 0; index < disciplineId.length; index += 1) {
    hash = (hash * 31 + disciplineId.charCodeAt(index)) >>> 0;
  }
  return DISCIPLINE_COLORS[hash % DISCIPLINE_COLORS.length];
}

export default function WeekCalendar({ entries, ariaLabel }: WeekCalendarProps) {
  const positioned = buildPositionedEntries(entries);

  const allStarts = positioned.map((entry) => entry.startMin);
  const allEnds = positioned.map((entry) => entry.endMin);
  const earliest = allStarts.length > 0 ? Math.min(...allStarts) : 8 * 60;
  const latest = allEnds.length > 0 ? Math.max(...allEnds) : 20 * 60;
  const firstHour = Math.max(0, Math.floor(earliest / 60) - 1);
  const lastHour = Math.min(24, Math.ceil(latest / 60) + 1);
  const totalMinutes = Math.max(60, (lastHour - firstHour) * 60);
  const totalHours = Math.ceil(totalMinutes / 60);
  const hourHeight = 30;
  const hours = Array.from({ length: totalHours + 1 }, (_, index) => firstHour + index);

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div
            className="grid"
            style={{ gridTemplateColumns: "42px repeat(7, minmax(0, 1fr))" }}
          >
            <div />
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-b border-slate-200 pb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {label}
              </div>
            ))}
          </div>

          <div
            role="img"
            aria-label={ariaLabel}
            className="grid"
            style={{
              gridTemplateColumns: "42px repeat(7, minmax(0, 1fr))",
              height: totalHours * hourHeight,
            }}
          >
            <div className="relative">
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-slate-400"
                  style={{ top: `${((hour - firstHour) / totalHours) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {DAY_LABELS.map((label, dayIndex) => {
              const dayEntries = positioned.filter(
                (entry) => entry.dayOfWeek === dayIndex + 1,
              );
              return (
                <div
                  key={label}
                  className="relative border-l border-slate-100"
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      aria-hidden="true"
                      className={`absolute inset-x-0 border-t ${
                        hour === firstHour ? "border-slate-200" : "border-slate-100"
                      }`}
                      style={{ top: `${((hour - firstHour) / totalHours) * 100}%` }}
                    />
                  ))}

                  {dayEntries.map((entry) => {
                    const top = ((entry.startMin - firstHour * 60) / totalMinutes) * 100;
                    const height = ((entry.endMin - entry.startMin) / totalMinutes) * 100;
                    const width = 100 / entry.lanes;
                    const background = entry.cancelled
                      ? "#fff1f2"
                      : colorFor(entry.disciplineId);

                    return (
                      <div
                        key={entry.id}
                        title={`${entry.disciplineName} · ${entry.startTime}–${entry.endTime}${
                          entry.location ? ` · ${entry.location}` : ""
                        }${entry.cancelled ? " · Annulée" : ""}`}
                        className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-[9px] leading-tight shadow-sm ring-1 ${
                          entry.cancelled
                            ? "text-rose-800 ring-rose-200"
                            : "text-white ring-black/5"
                        }`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(height, 4)}%`,
                          left: `${entry.lane * width}%`,
                          width: `calc(${width}% - 2px)`,
                          backgroundColor: background,
                        }}
                      >
                        <p className="font-semibold tabular-nums">
                          {entry.startTime}
                          {entry.cancelled ? " · annulée" : ""}
                        </p>
                        <p className="mt-0.5 truncate font-medium">
                          {entry.disciplineName}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
