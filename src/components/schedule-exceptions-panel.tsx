"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AssociationData } from "@/lib/site-data-types";
import { randomId } from "@/lib/ids";
import { DAY_LABELS } from "@/lib/schedule-constants";
import { buildWeekSchedule, formatWeekRangeLabel } from "@/lib/schedule-week";

type PendingNotify = {
  scheduleSlotId: string;
  date: string;
  reason: string;
  disciplineId: string;
};

type ScheduleExceptionsPanelProps = {
  canManageSite?: boolean;
};

const DAY_OPTIONS = Object.entries(DAY_LABELS) as [string, string][];

function timeToMinutes(value: string): number {
  const match = /^(\d{1,2})[h:](\d{0,2})/.exec(value.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2] || "0");
}

export default function ScheduleExceptionsPanel({
  canManageSite = false,
}: ScheduleExceptionsPanelProps) {
  const [data, setData] = useState<AssociationData | null>(null);
  const [cancelReasonByEntry, setCancelReasonByEntry] = useState<Record<string, string>>({});
  const [notifyByEntry, setNotifyByEntry] = useState<Record<string, boolean>>({});
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotify[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
  const [activityName, setActivityName] = useState("");
  const [annualFee, setAnnualFee] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [teacherName, setTeacherName] = useState("");

  const weekSchedule = useMemo(() => (data ? buildWeekSchedule(data) : []), [data]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(), []);

  const allSlots = useMemo(() => {
    if (!data) return [];
    return [...data.schedule].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }, [data]);

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
    setPendingNotifications([]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function disciplineName(disciplineId: string): string {
    return data?.disciplines.find((discipline) => discipline.id === disciplineId)?.name ?? "Activité";
  }

  function addScheduleException(
    entryId: string,
    scheduleSlotId: string,
    date: string,
    reason: string,
    disciplineId: string,
  ) {
    if (!data || !reason.trim()) return;
    const trimmedReason = reason.trim();
    const shouldNotify = notifyByEntry[entryId] !== false;

    setData((previous) => {
      if (!previous) return previous;
      const existing = previous.scheduleExceptions.find(
        (ex) => ex.scheduleSlotId === scheduleSlotId && ex.date === date,
      );
      if (existing) {
        return {
          ...previous,
          scheduleExceptions: previous.scheduleExceptions.map((ex) =>
            ex.id === existing.id ? { ...ex, reason: trimmedReason } : ex,
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
            reason: trimmedReason,
          },
        ],
      };
    });

    if (shouldNotify) {
      setPendingNotifications((previous) => {
        const withoutDuplicate = previous.filter(
          (item) => !(item.scheduleSlotId === scheduleSlotId && item.date === date),
        );
        return [
          ...withoutDuplicate,
          { scheduleSlotId, date, reason: trimmedReason, disciplineId },
        ];
      });
    }

    setCancelReasonByEntry((prev) => ({ ...prev, [entryId]: "" }));
  }

  function removeScheduleException(exceptionId: string, scheduleSlotId: string, date: string) {
    setData((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        scheduleExceptions: previous.scheduleExceptions.filter((ex) => ex.id !== exceptionId),
      };
    });
    setPendingNotifications((previous) =>
      previous.filter((item) => !(item.scheduleSlotId === scheduleSlotId && item.date === date)),
    );
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

    if (!response.ok) {
      setStatusMessage("Enregistrement impossible.");
      setIsLoading(false);
      return;
    }

    let message = "Exceptions enregistrées.";

    if (pendingNotifications.length > 0) {
      const notifyResponse = await fetch("/api/club/notify-cancellations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellations: pendingNotifications }),
      });
      const notifyPayload = (await notifyResponse.json()) as { message?: string };
      if (notifyResponse.ok) {
        message = `${message} ${notifyPayload.message ?? ""}`.trim();
        setPendingNotifications([]);
      } else {
        message = `${message} Notification e-mail impossible.`;
      }
    }

    setStatusMessage(message);
    setIsLoading(false);
  }

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activityName.trim() || !startTime || !endTime) {
      setStatusMessage("Indiquez l'activité et ses horaires.");
      return;
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      setStatusMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    setIsAdding(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/admin/schedule-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplineName: activityName.trim(),
          annualFee: annualFee.trim() || undefined,
          dayOfWeek: Number(dayOfWeek),
          startTime,
          endTime,
          location: location.trim(),
          teacherName: teacherName.trim(),
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Ajout impossible.");
      }
      setStatusMessage(payload.message ?? "Activité ajoutée.");
      setActivityName("");
      setAnnualFee("");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setTeacherName("");
      setDayOfWeek("1");
      setIsAddOpen(false);
      await loadData();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setIsAdding(false);
    }
  }

  async function deleteSlot(slotId: string) {
    const slot = data?.schedule.find((entry) => entry.id === slotId);
    if (!slot) return;
    const label = `${disciplineName(slot.disciplineId)} — ${slot.day} ${slot.startTime}-${slot.endTime}`;
    if (
      !window.confirm(
        `Supprimer le créneau « ${label} » ? Il disparaîtra du planning et du bulletin d'adhésion.`,
      )
    ) {
      return;
    }
    setDeletingSlotId(slotId);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/admin/schedule-slots?slotId=${encodeURIComponent(slotId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Suppression impossible.");
      }
      setStatusMessage(payload.message ?? "Créneau supprimé.");
      await loadData();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeletingSlotId(null);
    }
  }

  if (!data && isLoading) {
    return (
      <section className="bento-card p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Semaine et exceptions
        </h2>
        <p className="mt-3 text-sm text-slate-500">Chargement du planning…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="bento-card p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Semaine et exceptions
        </h2>
        <p className="mt-3 text-sm text-rose-600">
          {statusMessage || "Planning indisponible."}
        </p>
      </section>
    );
  }

  return (
    <section className="bento-card p-5">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">Semaine et exceptions</h2>
      <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
      <p className="mt-2 text-sm text-slate-600">
        Annule un cours ponctuellement (ex. professeur malade). Les créneaux viennent du planning par
        discipline.
      </p>

      {canManageSite ? (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
          <button
            type="button"
            onClick={() => setIsAddOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-semibold text-cyan-950">
              Ajouter une activité au planning
            </span>
            <span className="shrink-0 text-xs font-semibold text-cyan-800">
              {isAddOpen ? "Replier" : "Ouvrir"}
            </span>
          </button>
          <p className="mt-1 text-xs text-cyan-900/80">
            L&apos;activité apparaîtra automatiquement dans le bulletin d&apos;adhésion.
          </p>
          {isAddOpen ? (
            <form onSubmit={addActivity} className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                Nom de l&apos;activité
                <input
                  value={activityName}
                  onChange={(event) => setActivityName(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Ex. Théâtre / prise de parole, Randonnée, Danse…"
                  list="existing-activity-names"
                  required
                />
                <datalist id="existing-activity-names">
                  {data.disciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.name} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Jour
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                >
                  {DAY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Tarif annuel (facultatif)
                <input
                  value={annualFee}
                  onChange={(event) => setAnnualFee(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Ex. 180 EUR / an"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Heure de début
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Heure de fin
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Lieu
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Ex. Salle des fêtes"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Enseignant / intervenant
                <input
                  value={teacherName}
                  onChange={(event) => setTeacherName(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Facultatif"
                />
              </label>
              <button
                type="submit"
                disabled={isAdding}
                className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
              >
                {isAdding ? "Ajout en cours…" : "Ajouter l'activité"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {weekSchedule.length > 0 ? (
          weekSchedule.map((entry) => {
            const existingException = data.scheduleExceptions.find(
              (ex) => ex.scheduleSlotId === entry.scheduleSlotId && ex.date === entry.date,
            );
            const notifyChecked = notifyByEntry[entry.id] !== false;
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
                      onClick={() =>
                        removeScheduleException(
                          existingException.id,
                          entry.scheduleSlotId,
                          entry.date,
                        )
                      }
                      className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
                    >
                      Rétablir
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={cancelReasonByEntry[entry.id] ?? ""}
                        onChange={(event) =>
                          setCancelReasonByEntry((prev) => ({
                            ...prev,
                            [entry.id]: event.target.value,
                          }))
                        }
                        className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        placeholder="Motif"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const reason = cancelReasonByEntry[entry.id] ?? "";
                          addScheduleException(
                            entry.id,
                            entry.scheduleSlotId,
                            entry.date,
                            reason,
                            entry.disciplineId,
                          );
                        }}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Annuler ce cours
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={notifyChecked}
                        onChange={(event) =>
                          setNotifyByEntry((prev) => ({
                            ...prev,
                            [entry.id]: event.target.checked,
                          }))
                        }
                        className="rounded border-slate-300"
                      />
                      Prévenir les adhérents de la discipline par e-mail
                    </label>
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
      {pendingNotifications.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          {pendingNotifications.length} notification
          {pendingNotifications.length > 1 ? "s" : ""} e-mail en attente d&apos;enregistrement.
        </p>
      ) : null}

      <div className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="text-base font-semibold text-slate-900">Activités et créneaux du planning</h3>
        <p className="mt-1 text-xs text-slate-600">
          Toutes les activités ouvertes aux inscriptions. Un créneau ajouté ici devient
          immédiatement disponible dans le bulletin d&apos;adhésion.
        </p>
        <ul className="mt-3 space-y-2">
          {allSlots.map((slot) => (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {disciplineName(slot.disciplineId)}
                  {!slot.active ? (
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      Inactif
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-600">
                  {slot.day} · {slot.startTime}–{slot.endTime}
                  {slot.location ? ` · ${slot.location}` : ""}
                  {slot.teacherName ? ` · ${slot.teacherName}` : ""}
                </p>
              </div>
              {canManageSite ? (
                <button
                  type="button"
                  disabled={deletingSlotId === slot.id}
                  onClick={() => void deleteSlot(slot.id)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                >
                  {deletingSlotId === slot.id ? "Suppression…" : "Supprimer"}
                </button>
              ) : null}
            </li>
          ))}
          {allSlots.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-600">
              Aucune activité dans le planning.
            </li>
          ) : null}
        </ul>
      </div>

      {statusMessage ? <p className="mt-2 text-sm text-slate-600">{statusMessage}</p> : null}
    </section>
  );
}
