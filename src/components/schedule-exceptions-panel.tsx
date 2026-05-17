"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssociationData } from "@/lib/site-data-types";
import { buildWeekSchedule, formatWeekRangeLabel } from "@/lib/schedule-week";

export default function ScheduleExceptionsPanel() {
  const [data, setData] = useState<AssociationData | null>(null);
  const [cancelReasonByEntry, setCancelReasonByEntry] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const weekSchedule = useMemo(() => (data ? buildWeekSchedule(data) : []), [data]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(), []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/admin/site-data");
    if (!response.ok) {
      setStatusMessage("Impossible de charger le planning.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as AssociationData;
    setData({ ...payload, scheduleExceptions: payload.scheduleExceptions ?? [] });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function randomId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function addScheduleException(scheduleSlotId: string, date: string, reason: string) {
    if (!data || !reason.trim()) return;
    setData((previous) => {
      if (!previous) return previous;
      const existing = previous.scheduleExceptions.find(
        (ex) => ex.scheduleSlotId === scheduleSlotId && ex.date === date
      );
      if (existing) {
        return {
          ...previous,
          scheduleExceptions: previous.scheduleExceptions.map((ex) =>
            ex.id === existing.id ? { ...ex, reason: reason.trim() } : ex
          ),
        };
      }
      return {
        ...previous,
        scheduleExceptions: [
          ...previous.scheduleExceptions,
          {
            id: randomId("exception"),
            scheduleSlotId,
            date,
            status: "cancelled" as const,
            reason: reason.trim(),
          },
        ],
      };
    });
  }

  function removeScheduleException(exceptionId: string) {
    setData((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        scheduleExceptions: previous.scheduleExceptions.filter((ex) => ex.id !== exceptionId),
      };
    });
  }

  async function saveExceptions() {
    if (!data) return;
    setIsLoading(true);
    setStatusMessage("");
    const response = await fetch("/api/admin/site-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleExceptions: data.scheduleExceptions }),
    });
    setStatusMessage(response.ok ? "Exceptions enregistrées." : "Enregistrement impossible.");
    setIsLoading(false);
  }

  if (!data && isLoading) {
    return <p className="text-sm text-slate-600">Chargement du planning…</p>;
  }

  if (!data) {
    return <p className="text-sm text-rose-600">{statusMessage || "Planning indisponible."}</p>;
  }

  return (
    <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Semaine et exceptions</h2>
      <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
      <p className="mt-2 text-sm text-slate-600">
        Annule un cours ponctuellement (ex. professeur malade). Les créneaux viennent du planning par discipline.
      </p>
      <div className="mt-4 space-y-3">
        {weekSchedule.length > 0 ? (
          weekSchedule.map((entry) => {
            const existingException = data.scheduleExceptions.find(
              (ex) => ex.scheduleSlotId === entry.scheduleSlotId && ex.date === entry.date
            );
            return (
              <article
                key={entry.id}
                className={`rounded-xl border p-3 ${
                  entry.cancelled ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="font-semibold text-slate-900">
                  {entry.dayLabel} — {entry.disciplineName}
                </p>
                <p className="text-sm text-slate-700">
                  {entry.startTime} - {entry.endTime} · {entry.location}
                </p>
                {existingException ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                      Annulé : {existingException.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeScheduleException(existingException.id)}
                      className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
                    >
                      Rétablir
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={cancelReasonByEntry[entry.id] ?? ""}
                      onChange={(event) =>
                        setCancelReasonByEntry((prev) => ({ ...prev, [entry.id]: event.target.value }))
                      }
                      className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      placeholder="Motif"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const reason = cancelReasonByEntry[entry.id] ?? "";
                        addScheduleException(entry.scheduleSlotId, entry.date, reason);
                        setCancelReasonByEntry((prev) => ({ ...prev, [entry.id]: "" }));
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Annuler ce cours
                    </button>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p className="text-sm text-slate-600">Aucun créneau actif cette semaine.</p>
        )}
      </div>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => void saveExceptions()}
        className="mt-4 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Enregistrer les exceptions
      </button>
      {statusMessage ? <p className="mt-2 text-sm text-slate-600">{statusMessage}</p> : null}
    </section>
  );
}
