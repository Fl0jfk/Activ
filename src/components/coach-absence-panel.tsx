"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, ConfirmDialog, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import type { CoachAbsenceRequest } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import { formatParisDateTime } from "@/lib/paris-time";
import { formatDayLabelFr } from "@/lib/schedule-week";

type CoachAbsencePanelProps = {
  disciplines: DisciplineOption[];
  pending: CoachAbsenceRequest[];
  recent: CoachAbsenceRequest[];
  /** Adhérents approuvés par discipline (nombre d'e-mails envoyés à la validation). */
  memberCounts: Record<string, number>;
};

type Review = { request: CoachAbsenceRequest; action: "approved" | "rejected" };

export default function CoachAbsencePanel({ disciplines, pending, recent, memberCounts }: CoachAbsencePanelProps) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<Feedback>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [handledIds, setHandledIds] = useState<string[]>([]);

  const disciplineName = (id: string) => disciplines.find((discipline) => discipline.id === id)?.name ?? "Discipline";
  const visiblePending = pending.filter((request) => !handledIds.includes(request.id));

  async function submitReview() {
    if (!review) return;
    setBusy(true);
    setDialogError(null);
    try {
      const result = await fetchJson<{ notifyError?: string }>(
        `/api/club/coach-absence-requests/${encodeURIComponent(review.request.id)}`,
        jsonInit("PATCH", { action: review.action }),
      );
      if (!result.ok) {
        setDialogError({
          tone: "error",
          text: result.message || "La demande n’a pas pu être traitée. Réessayez.",
        });
        return;
      }
      setHandledIds((ids) => [...ids, review.request.id]);
      setFeedback({
        tone: result.data?.notifyError ? "error" : "success",
        text: result.message || "Demande traitée.",
      });
      setReview(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const approving = review?.action === "approved";
  const reviewedMembers = review ? (memberCounts[review.request.disciplineId] ?? 0) : 0;

  return (
    <SectionCard
      id="absences-coach"
      eyebrow="Validation par le président"
      title="Absences coach"
      description="Une fois validée, l’absence apparaît sur le site et les adhérents de l’activité sont prévenus par e-mail."
    >
      <div className="space-y-5">
        <StatusMessage feedback={feedback} />

        {visiblePending.length === 0 ? (
          <EmptyState>Aucune demande d’absence en attente.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {visiblePending.map((request) => (
              <li key={request.id} className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="violet">À valider</Badge>
                  <Badge tone="blue">{disciplineName(request.disciplineId)}</Badge>
                </div>
                <p className="mt-2 text-base font-extrabold text-slate-900">{request.coachName}</p>
                <p className="text-sm text-slate-800">
                  Séance du <strong>{formatDayLabelFr(request.sessionDate)}</strong>
                </p>
                <p className="mt-2 text-sm text-slate-800">
                  <strong>Motif :</strong> {request.reason}
                </p>
                <p className="mt-1 text-xs text-slate-600">Demande faite le {formatParisDateTime(request.createdAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDialogError(null);
                      setReview({ request, action: "approved" });
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    Valider l’absence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDialogError(null);
                      setReview({ request, action: "rejected" });
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {recent.length > 0 ? (
          <details className="rounded-2xl border border-brand-line bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Historique récent ({recent.length})
            </summary>
            <ul className="mt-3 divide-y divide-brand-line">
              {recent.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {request.coachName} · {disciplineName(request.disciplineId)}
                    </p>
                    <p className="text-slate-600">{formatDayLabelFr(request.sessionDate)}</p>
                  </div>
                  <Badge tone={request.status === "approved" ? "green" : "slate"}>
                    {request.status === "approved" ? "Validée" : "Refusée"}
                  </Badge>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <ConfirmDialog
        open={review !== null}
        title={approving ? "Valider cette absence ?" : "Refuser cette demande ?"}
        message={
          review ? (
            <>
              <p>
                <strong>{review.request.coachName}</strong> — {disciplineName(review.request.disciplineId)},{" "}
                {formatDayLabelFr(review.request.sessionDate)}.
              </p>
              {approving ? (
                <p className="mt-2">
                  La séance sera annulée sur le site.{" "}
                  {reviewedMembers > 0
                    ? `Un e-mail sera envoyé à ${reviewedMembers} adhérent${reviewedMembers > 1 ? "s" : ""} de l’activité.`
                    : "Aucun adhérent n’est inscrit à cette activité : aucun e-mail ne partira."}
                </p>
              ) : (
                <p className="mt-2">La séance reste maintenue au planning. Le coach n’est pas prévenu automatiquement.</p>
              )}
            </>
          ) : null
        }
        confirmLabel={approving ? "Oui, valider l’absence" : "Oui, refuser"}
        cancelLabel="Non, revenir"
        tone={approving ? "primary" : "danger"}
        busy={busy}
        onConfirm={() => void submitReview()}
        onCancel={() => setReview(null)}
      >
        <StatusMessage feedback={dialogError} />
      </ConfirmDialog>
    </SectionCard>
  );
}
