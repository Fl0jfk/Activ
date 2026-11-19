"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, ConfirmDialog, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import PlanningModal from "@/components/planning-modal";
import TrialSlotCreateForm from "@/components/trial-slot-create-form";
import type { ApplicationStatus } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { fetchJson } from "@/lib/fetch-json";
import { formatParisDateTime } from "@/lib/paris-time";
import type { TrialSlotRow } from "@/lib/trial-slots";

type TrialSlotsPanelProps = {
  /** Activités actives proposées dans le formulaire de création. */
  disciplines: DisciplineOption[];
  /** Toutes les activités (y compris désactivées), pour afficher le nom des créneaux existants. */
  allDisciplines?: DisciplineOption[];
  slots: TrialSlotRow[];
  /** Instant de référence (ISO) fixé par le serveur pour séparer « à venir » et « passés ». */
  nowIso: string;
};

const STATUS_LABELS: Record<ApplicationStatus, { label: string; tone: "green" | "orange" | "slate" | "rose" }> = {
  pending: { label: "En attente", tone: "orange" },
  awaiting_document: { label: "Pièce attendue", tone: "orange" },
  approved: { label: "Validé", tone: "green" },
  rejected: { label: "Refusé", tone: "rose" },
  cancelled: { label: "Annulé", tone: "slate" },
};

export default function TrialSlotsPanel({ disciplines, allDisciplines, slots, nowIso }: TrialSlotsPanelProps) {
  const router = useRouter();
  const [showPast, setShowPast] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TrialSlotRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<Feedback>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const now = new Date(nowIso).getTime();
  const upcoming = slots.filter((slot) => new Date(slot.startsAt).getTime() >= now);
  const past = slots.filter((slot) => new Date(slot.startsAt).getTime() < now).reverse();
  const shown = showPast ? past : upcoming;
  const disciplineName = (id: string) =>
    (allDisciplines ?? disciplines).find((discipline) => discipline.id === id)?.name ?? "Discipline";

  async function deleteSlot() {
    if (!toDelete) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const result = await fetchJson(`/api/club/trial-slots?id=${encodeURIComponent(toDelete.id)}`, {
        method: "DELETE",
      });
      if (!result.ok) {
        setDeleteError({
          tone: "error",
          text: result.message || "Le créneau n’a pas pu être supprimé. Réessayez.",
        });
        return;
      }
      setFeedback({ tone: "success", text: result.message || "Créneau supprimé." });
      setToDelete(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      eyebrow="Essais"
      title="Créneaux d’essai"
      description="Séances de découverte proposées au public. Chaque personne inscrite apparaît dans la liste du créneau."
      action={
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setCreateOpen(true);
          }}
          className="btn btn-primary btn-sm"
        >
          + Nouveau créneau d’essai
        </button>
      }
    >
      <div className="space-y-4">
        <StatusMessage feedback={feedback} />

        <div
          className="inline-flex rounded-full border border-brand-line bg-white p-1"
          role="group"
          aria-label="Période des créneaux"
        >
          {(
            [
              [false, `À venir (${upcoming.length})`],
              [true, `Passés (${past.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setShowPast(value)}
              aria-pressed={showPast === value}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                showPast === value ? "bg-brand-blue text-white" : "text-slate-600 hover:text-brand-blue"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState>
            {showPast
              ? "Aucun créneau d’essai passé."
              : "Aucun créneau d’essai à venir. Utilisez le bouton « Nouveau créneau d’essai » pour en proposer un."}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {shown.map((slot) => {
              const registered = slot.registrants.length;
              const full = registered >= slot.capacity;
              const expanded = expandedId === slot.id;
              const percent = Math.min(100, Math.round((registered / Math.max(1, slot.capacity)) * 100));
              return (
                <li key={slot.id} className="rounded-2xl border border-brand-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-extrabold text-slate-900">{slot.title}</p>
                      <p className="mt-0.5 text-sm text-slate-700">{formatParisDateTime(slot.startsAt)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone="blue">{disciplineName(slot.disciplineId)}</Badge>
                        {full ? <Badge tone="orange">Complet</Badge> : null}
                        {showPast ? <Badge>Passé</Badge> : null}
                      </div>
                    </div>
                    <div className="w-full min-w-[10rem] sm:w-48">
                      <p className="text-sm font-semibold text-slate-900">
                        {registered} inscrit{registered > 1 ? "s" : ""} sur {slot.capacity}
                      </p>
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label="Places occupées"
                        aria-valuemin={0}
                        aria-valuemax={slot.capacity}
                        aria-valuenow={Math.min(registered, slot.capacity)}
                      >
                        <div
                          className={`h-full rounded-full ${full ? "bg-brand-orange" : "bg-brand-green"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : slot.id)}
                      aria-expanded={expanded}
                      aria-controls={`inscrits-${slot.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      {expanded ? "Masquer les inscrits" : `Voir les inscrits (${registered})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setToDelete(slot);
                      }}
                      className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      Supprimer
                    </button>
                  </div>

                  {expanded ? (
                    <div id={`inscrits-${slot.id}`} className="mt-3 border-t border-brand-line pt-3">
                      {registered === 0 ? (
                        <p className="text-sm text-slate-600">Personne n’est encore inscrit à ce créneau.</p>
                      ) : (
                        <ul className="divide-y divide-brand-line">
                          {slot.registrants.map((person) => {
                            const status = STATUS_LABELS[person.status];
                            return (
                              <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                                  <p className="break-words text-sm text-slate-600">
                                    {[person.email, person.phone].filter(Boolean).join(" · ")}
                                  </p>
                                </div>
                                <Badge tone={status.tone}>{status.label}</Badge>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PlanningModal
        open={createOpen}
        title="Nouveau créneau d’essai"
        subtitle="Essais"
        onClose={() => setCreateOpen(false)}
      >
        <TrialSlotCreateForm
          disciplines={disciplines}
          onCancel={() => setCreateOpen(false)}
          onCreated={(message) => {
            setCreateOpen(false);
            setFeedback({ tone: "success", text: message });
          }}
        />
      </PlanningModal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer ce créneau d’essai ?"
        message={
          toDelete ? (
            <>
              <p>
                <strong>{toDelete.title}</strong> — {formatParisDateTime(toDelete.startsAt)}
              </p>
              <p className="mt-2">
                {toDelete.registrants.length > 0
                  ? `${toDelete.registrants.length} personne${toDelete.registrants.length > 1 ? "s sont inscrites" : " est inscrite"} à ce créneau. Leurs dossiers sont conservés, mais le créneau disparaît du site et elles ne sont pas prévenues automatiquement : pensez à les contacter.`
                  : "Personne n’est inscrit à ce créneau. Il disparaîtra du site."}
              </p>
            </>
          ) : null
        }
        confirmLabel="Oui, supprimer"
        cancelLabel="Non, le garder"
        tone="danger"
        busy={busy}
        onConfirm={() => void deleteSlot()}
        onCancel={() => setToDelete(null)}
      >
        <StatusMessage feedback={deleteError} />
      </ConfirmDialog>
    </SectionCard>
  );
}
