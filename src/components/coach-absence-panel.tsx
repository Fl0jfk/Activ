"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoachAbsenceRequest } from "@/lib/club-data";

type Discipline = { id: string; name: string };

type CoachAbsencePanelProps = {
  disciplines: Discipline[];
};

export default function CoachAbsencePanel({ disciplines }: CoachAbsencePanelProps) {
  const [pending, setPending] = useState<CoachAbsenceRequest[]>([]);
  const [recent, setRecent] = useState<CoachAbsenceRequest[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/club/coach-absence-requests");
    if (!response.ok) {
      setMessage("Impossible de charger les demandes d'absence.");
      setLoading(false);
      return;
    }
    const data = (await response.json()) as {
      pending: CoachAbsenceRequest[];
      recent: CoachAbsenceRequest[];
    };
    setPending(data.pending);
    setRecent(data.recent);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "approved" | "rejected") {
    setMessage("");
    const response = await fetch(`/api/club/coach-absence-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setMessage(body.message ?? "Demande traitée.");
      await load();
      if (action === "approved") {
        window.location.reload();
      }
    } else {
      setMessage(body.message ?? "Erreur.");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Chargement des absences coach…</p>;
  }

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Aucune demande d&apos;absence en attente.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map((request) => {
            const disciplineName =
              disciplines.find((d) => d.id === request.disciplineId)?.name ?? "Discipline";
            return (
              <article
                key={request.id}
                className="rounded-xl border border-violet-200 bg-violet-50 p-4"
              >
                <p className="text-xs font-semibold uppercase text-violet-800">À valider</p>
                <p className="mt-1 font-semibold text-slate-900">{request.coachName}</p>
                <p className="text-sm text-slate-700">
                  {disciplineName} — séance du{" "}
                  {new Date(request.sessionDate).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="mt-2 text-sm text-slate-800">
                  <strong>Motif :</strong> {request.reason}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void review(request.id, "approved")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Valider l&apos;absence
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(request.id, "rejected")}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    Refuser
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {recent.length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Historique récent ({recent.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {recent.map((request) => (
              <li key={request.id}>
                {request.coachName} — {request.sessionDate} —{" "}
                {request.status === "approved" ? "Validée" : "Refusée"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
    </div>
  );
}
