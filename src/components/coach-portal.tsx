"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CoachAbsenceRequest } from "@/lib/club-data";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

const REQUEST_STATUS_LABELS: Record<CoachAbsenceRequest["status"], string> = {
  pending: "En attente de validation",
  approved: "Validée",
  rejected: "Refusée",
};

export default function CoachPortal() {
  const [sessions, setSessions] = useState<WeekScheduleEntry[]>([]);
  const [requests, setRequests] = useState<CoachAbsenceRequest[]>([]);
  const [selectedSession, setSelectedSession] = useState<WeekScheduleEntry | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/coach/my-sessions");
    if (!response.ok) {
      setMessage("Impossible de charger vos séances.");
      setLoading(false);
      return;
    }
    const data = (await response.json()) as {
      sessions: WeekScheduleEntry[];
      requests: CoachAbsenceRequest[];
    };
    setSessions(data.sessions);
    setRequests(data.requests);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingBySession = new Set(
    requests
      .filter((r) => r.status === "pending")
      .map((r) => `${r.scheduleSlotId}:${r.sessionDate}`)
  );

  async function submitAbsence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSession || !reason.trim()) return;

    setMessage("");
    const response = await fetch("/api/coach/absence-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleSlotId: selectedSession.scheduleSlotId,
        sessionDate: selectedSession.date,
        reason: reason.trim(),
      }),
    });
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setMessage(body.message ?? "Demande envoyée.");
      setReason("");
      setSelectedSession(null);
      await load();
    } else {
      setMessage(body.message ?? "Erreur.");
    }
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-4xl space-y-6 px-4 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Espace coach</h1>
        <p className="mt-1 text-slate-600">
          Vos prochaines séances sur le mois à venir. Déclarez une absence : la direction validera
          avant publication sur le site.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-600">Chargement…</p>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Mes prochaines séances</h2>
            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Aucune séance trouvée sur les 4 prochaines semaines (vérifiez votre nom sur le
                planning).
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {sessions.map((session) => {
                  const key = `${session.scheduleSlotId}:${session.date}`;
                  const hasPending = pendingBySession.has(key);
                  const isSelected = selectedSession?.id === session.id;

                  return (
                    <li
                      key={session.id}
                      className={`rounded-xl border p-4 ${
                        session.cancelled
                          ? "border-rose-200 bg-rose-50"
                          : isSelected
                            ? "border-cyan-300 bg-cyan-50"
                            : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{session.disciplineName}</p>
                      <p className="text-sm text-slate-700">
                        {session.dayLabel} — {session.startTime}–{session.endTime} — {session.location}
                      </p>
                      {session.cancelled ? (
                        <p className="mt-1 text-sm font-medium text-rose-700">
                          Séance annulée{session.cancelReason ? ` : ${session.cancelReason}` : ""}
                        </p>
                      ) : hasPending ? (
                        <p className="mt-1 text-sm font-medium text-amber-700">
                          Demande d&apos;absence en attente
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedSession(session)}
                          className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                        >
                          Déclarer une absence
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {selectedSession ? (
            <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
              <h2 className="text-lg font-bold text-slate-900">Absence — {selectedSession.dayLabel}</h2>
              <p className="text-sm text-slate-700">
                {selectedSession.disciplineName} ({selectedSession.startTime}–{selectedSession.endTime})
              </p>
              <form onSubmit={submitAbsence} className="mt-4 space-y-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Motif de l&apos;absence
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    rows={3}
                    required
                    placeholder="Ex : indisponibilité professionnelle"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Envoyer à la direction
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSession(null);
                      setReason("");
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {requests.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Mes demandes d&apos;absence</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {requests.map((request) => (
                  <li key={request.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    {new Date(request.sessionDate).toLocaleDateString("fr-FR")} —{" "}
                    {REQUEST_STATUS_LABELS[request.status]} — {request.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {message ? (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{message}</p>
      ) : null}
    </div>
  );
}
