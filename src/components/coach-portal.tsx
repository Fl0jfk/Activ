"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import { entryTimeLabel } from "@/components/bureau-week-calendar";
import { FormField, FormTextarea } from "@/components/forms/form-field";
import PlanningModal from "@/components/planning-modal";
import type { CoachAbsenceRequest } from "@/lib/club-data";
import { fetchJson, jsonInit, type ApiResult } from "@/lib/fetch-json";
import { formatDayLabelFr, type WeekScheduleEntry } from "@/lib/schedule-week";

type MySessionsResponse = {
  sessions: WeekScheduleEntry[];
  requests: CoachAbsenceRequest[];
  disciplineNames?: Record<string, string>;
};

const REQUEST_STATUS: Record<CoachAbsenceRequest["status"], { label: string; tone: "orange" | "green" | "slate" }> = {
  pending: { label: "En attente de validation", tone: "orange" },
  approved: { label: "Validée", tone: "green" },
  rejected: { label: "Refusée", tone: "slate" },
};

export default function CoachPortal() {
  const [sessions, setSessions] = useState<WeekScheduleEntry[]>([]);
  const [requests, setRequests] = useState<CoachAbsenceRequest[]>([]);
  const [disciplineNames, setDisciplineNames] = useState<Record<string, string>>({});
  const [selectedSession, setSelectedSession] = useState<WeekScheduleEntry | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<Feedback>(null);
  const [formFeedback, setFormFeedback] = useState<Feedback>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const applyResult = useCallback((result: ApiResult<MySessionsResponse>) => {
    if (!result.ok || !result.data) {
      setLoadError({
        tone: "error",
        text: result.message || "Impossible de charger vos séances. Actualisez la page pour réessayer.",
      });
      setLoading(false);
      return;
    }
    setLoadError(null);
    setSessions(result.data.sessions ?? []);
    setRequests(result.data.requests ?? []);
    setDisciplineNames(result.data.disciplineNames ?? {});
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchJson<MySessionsResponse>("/api/coach/my-sessions").then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [applyResult]);
  const pendingBySession = new Set(
    requests.filter((r) => r.status === "pending").map((r) => `${r.scheduleSlotId}:${r.sessionDate}`),
  );

  function closeForm() {
    if (submitting) return;
    setSelectedSession(null);
    setReason("");
    setFormFeedback(null);
  }

  async function submitAbsence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSession || submitting) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setFormFeedback({ tone: "error", text: "Indiquez le motif de votre absence." });
      return;
    }

    setSubmitting(true);
    setFormFeedback(null);
    try {
      const result = await fetchJson(
        "/api/coach/absence-requests",
        jsonInit("POST", {
          scheduleSlotId: selectedSession.scheduleSlotId,
          sessionDate: selectedSession.date,
          reason: trimmedReason,
        }),
      );
      if (!result.ok) {
        setFormFeedback({
          tone: "error",
          text: result.message || "Votre demande n’a pas pu être envoyée. Réessayez.",
        });
        return;
      }
      setFeedback({ tone: "success", text: result.message || "Demande envoyée à la direction." });
      setSelectedSession(null);
      setReason("");
      applyResult(await fetchJson<MySessionsResponse>("/api/coach/my-sessions"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-4xl space-y-6 px-4 sm:px-8">
      <header>
        <span className="eyebrow">Espace coach</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Mes prochaines séances</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600">
          Vos séances des quatre prochaines semaines. Si vous ne pouvez pas venir, déclarez votre
          absence : la direction la validera avant sa publication sur le site.
        </p>
      </header>

      <StatusMessage feedback={loadError} />

      {loading ? (
        <p className="text-sm text-slate-600" role="status">
          Chargement de vos séances…
        </p>
      ) : (
        <>
          <SectionCard title="Séances à venir">
            <div className="space-y-4">
              <StatusMessage feedback={feedback} />
              {sessions.length === 0 ? (
                <EmptyState>
                  Aucune séance trouvée sur les 4 prochaines semaines. Vérifiez que votre nom figure bien
                  sur le planning.
                </EmptyState>
              ) : (
                <ul className="space-y-3">
                  {sessions.map((session) => {
                    const hasPending = pendingBySession.has(`${session.scheduleSlotId}:${session.date}`);
                    return (
                      <li
                        key={session.id}
                        className={`rounded-2xl border p-4 ${
                          session.cancelled ? "border-rose-200 bg-rose-50" : "border-brand-line bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-extrabold text-slate-900">{session.disciplineName}</p>
                            <p className="text-sm text-slate-800">
                              {session.dayLabel} · {entryTimeLabel(session)}
                            </p>
                            {session.location ? (
                              <p className="text-sm text-slate-600">{session.location}</p>
                            ) : null}
                          </div>
                          {session.cancelled ? (
                            <Badge tone="rose">Annulée</Badge>
                          ) : hasPending ? (
                            <Badge tone="orange">Demande en attente</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFeedback(null);
                                setFormFeedback(null);
                                setSelectedSession(session);
                              }}
                              className="btn btn-outline btn-sm"
                            >
                              Déclarer une absence
                            </button>
                          )}
                        </div>
                        {session.cancelled && session.cancelReason ? (
                          <p className="mt-2 text-sm font-medium text-rose-800">Motif : {session.cancelReason}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </SectionCard>

          {requests.length > 0 ? (
            <SectionCard title="Mes demandes d’absence">
              <ul className="divide-y divide-brand-line">
                {requests.map((request) => {
                  const status = REQUEST_STATUS[request.status];
                  return (
                    <li key={request.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {disciplineNames[request.disciplineId] ?? "Séance"} · {formatDayLabelFr(request.sessionDate)}
                        </p>
                        <p className="text-sm text-slate-600">Motif : {request.reason}</p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          ) : null}
        </>
      )}

      <PlanningModal
        open={selectedSession !== null}
        title="Déclarer une absence"
        subtitle={selectedSession ? selectedSession.dayLabel : undefined}
        onClose={closeForm}
      >
        {selectedSession ? (
          <form onSubmit={submitAbsence} className="space-y-4" noValidate>
            <p className="text-sm text-slate-800">
              <strong>{selectedSession.disciplineName}</strong> · {entryTimeLabel(selectedSession)}
            </p>
            <FormField label="Motif de l’absence" hint="La direction lira ce message avant de valider.">
              <FormTextarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
                required
                placeholder="Ex. Indisponibilité professionnelle"
              />
            </FormField>
            <StatusMessage feedback={formFeedback} />
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={submitting} className="btn btn-ghost btn-sm">
                Annuler
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
                {submitting ? "Envoi en cours…" : "Envoyer à la direction"}
              </button>
            </div>
          </form>
        ) : null}
      </PlanningModal>
    </div>
  );
}
