"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { entryTimeLabel } from "@/components/bureau-week-calendar";
import { ConfirmDialog, StatusMessage, type Feedback } from "@/components/bureau-ui";
import { FormField, FormTextarea } from "@/components/forms/form-field";
import PlanningModal from "@/components/planning-modal";
import type { DisciplineColor } from "@/lib/discipline-colors";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

type NotifyData = {
  notified?: number;
  failed?: number;
  recipientCount?: number;
  notifyError?: string;
};

type Busy = "cancel" | "restore" | "delete" | "retry" | null;

type PlanningSessionDialogProps = {
  entry: WeekScheduleEntry | null;
  color: DisciplineColor;
  todayIso: string;
  canManageSlots: boolean;
  /** Nombre d'adhérents approuvés dans la discipline de la séance. */
  memberCount: number;
  onClose: () => void;
  onFeedback: (feedback: Feedback) => void;
};

function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one;
}

function describeCancellation(data: NotifyData | null, notify: boolean): { feedback: Feedback; canRetry: boolean } {
  if (!notify) {
    return {
      feedback: { tone: "success", text: "Annulation enregistrée. Aucun e-mail n’a été envoyé." },
      canRetry: false,
    };
  }
  const notified = data?.notified ?? 0;
  if (data?.notifyError) {
    const text =
      notified > 0
        ? `Annulation enregistrée, ${notified} ${plural(notified, "adhérent prévenu", "adhérents prévenus")}, mais ${data.notifyError.charAt(0).toLowerCase()}${data.notifyError.slice(1)}`
        : `Annulation enregistrée, mais l’e-mail n’a pas pu partir : ${data.notifyError}`;
    return { feedback: { tone: "error", text }, canRetry: notified === 0 };
  }
  if ((data?.recipientCount ?? 0) === 0) {
    return {
      feedback: {
        tone: "success",
        text: "Annulation enregistrée. Aucun adhérent n’est inscrit à cette activité : personne à prévenir.",
      },
      canRetry: false,
    };
  }
  return {
    feedback: {
      tone: "success",
      text: `Annulation enregistrée, ${notified} ${plural(notified, "adhérent prévenu", "adhérents prévenus")}.`,
    },
    canRetry: false,
  };
}

function SessionContent({
  entry,
  todayIso,
  canManageSlots,
  memberCount,
  onClose,
  onFeedback,
}: Omit<PlanningSessionDialogProps, "entry" | "color"> & { entry: WeekScheduleEntry }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [override, setOverride] = useState<{ cancelled: boolean; reason: string } | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "restore" | "delete" | null>(null);

  const cancelled = override ? override.cancelled : entry.cancelled;
  const shownReason = override ? override.reason : (entry.cancelReason ?? "");
  const isPast = entry.date < todayIso;
  const trimmedReason = reason.trim();
  const sessionLabel = `${entry.disciplineName}, ${entry.dayLabel}, ${entryTimeLabel(entry)}`;

  function askCancel() {
    if (!trimmedReason) {
      setFeedback({ tone: "error", text: "Indiquez le motif de l’annulation avant de continuer." });
      return;
    }
    setFeedback(null);
    setConfirm("cancel");
  }

  async function cancelSession() {
    setBusy("cancel");
    setFeedback(null);
    try {
      const result = await fetchJson<NotifyData>(
        "/api/admin/schedule-exceptions",
        jsonInit("POST", {
          scheduleSlotId: entry.scheduleSlotId,
          date: entry.date,
          reason: trimmedReason,
          notify,
        }),
      );
      setConfirm(null);
      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.message || "L’annulation n’a pas pu être enregistrée. Réessayez.",
        });
        return;
      }
      const outcome = describeCancellation(result.data, notify);
      setFeedback(outcome.feedback);
      setCanRetry(outcome.canRetry);
      setOverride({ cancelled: true, reason: trimmedReason });
      setReason("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function retryNotification() {
    setBusy("retry");
    setFeedback(null);
    try {
      const result = await fetchJson<NotifyData>(
        "/api/club/notify-cancellations",
        jsonInit("POST", {
          cancellations: [{ scheduleSlotId: entry.scheduleSlotId, date: entry.date }],
        }),
      );
      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: `L’annulation est enregistrée, mais l’e-mail n’a pas pu partir : ${result.message || "réessayez dans un instant."}`,
        });
        setCanRetry(true);
        return;
      }
      const outcome = describeCancellation(result.data, true);
      setFeedback(outcome.feedback);
      setCanRetry(outcome.canRetry);
    } finally {
      setBusy(null);
    }
  }

  async function restoreSession() {
    setBusy("restore");
    setFeedback(null);
    try {
      const result = await fetchJson(
        "/api/admin/schedule-exceptions",
        jsonInit("DELETE", { scheduleSlotId: entry.scheduleSlotId, date: entry.date }),
      );
      setConfirm(null);
      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.message || "La séance n’a pas pu être rétablie. Réessayez.",
        });
        return;
      }
      setFeedback({
        tone: "success",
        text: "Séance rétablie. Les adhérents déjà prévenus de l’annulation ne reçoivent pas de nouvel e-mail : pensez à les informer.",
      });
      setCanRetry(false);
      setOverride({ cancelled: false, reason: "" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteSlot() {
    setBusy("delete");
    setFeedback(null);
    try {
      const result = await fetchJson(
        `/api/admin/schedule-slots?slotId=${encodeURIComponent(entry.scheduleSlotId)}`,
        { method: "DELETE" },
      );
      setConfirm(null);
      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.message || "Le créneau n’a pas pu être supprimé. Réessayez.",
        });
        return;
      }
      router.refresh();
      onFeedback({ tone: "success", text: result.message || "Créneau supprimé du planning." });
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <dl className="space-y-2 text-[15px]">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 font-bold text-slate-600">Horaire</dt>
          <dd className="font-semibold text-slate-900">{entryTimeLabel(entry)}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 font-bold text-slate-600">Lieu</dt>
          <dd className="text-slate-800">{entry.location || "Non précisé"}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 font-bold text-slate-600">Coach</dt>
          <dd className="text-slate-800">{entry.teacherName || "Non précisé"}</dd>
        </div>
      </dl>

      {cancelled ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800 ring-1 ring-rose-200">
          <p className="font-bold">Séance annulée</p>
          {shownReason ? <p className="mt-0.5 text-sm">Motif : {shownReason}</p> : null}
        </div>
      ) : null}

      {isPast ? (
        <StatusMessage
          feedback={{ tone: "info", text: "Cette séance est passée : elle ne peut plus être modifiée." }}
        />
      ) : null}

      {!isPast && cancelled ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setConfirm("restore")}
            disabled={busy !== null}
            className="btn btn-outline btn-sm"
          >
            Rétablir la séance
          </button>
        </div>
      ) : null}

      {!isPast && !cancelled ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            askCancel();
          }}
          className="space-y-3 rounded-2xl border border-brand-line bg-brand-cream/50 p-4"
          noValidate
        >
          <h3 className="text-base font-extrabold text-slate-900">Annuler cette séance</h3>
          <FormField label="Motif de l’annulation (obligatoire)" hint="Ce motif est affiché sur le site et envoyé aux adhérents.">
            <FormTextarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Ex. Le coach est malade"
              aria-invalid={feedback?.tone === "error" && !trimmedReason}
              required
            />
          </FormField>
          <label className="flex items-start gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400"
            />
            <span>
              <span className="font-semibold">Prévenir les adhérents par e-mail</span>
              <span className="block text-xs text-slate-600">
                {memberCount > 0
                  ? `${memberCount} ${plural(memberCount, "adhérent de l’activité recevra", "adhérents de l’activité recevront")} un message.`
                  : "Aucun adhérent n’est inscrit à cette activité pour le moment."}
              </span>
            </span>
          </label>
          <button type="submit" disabled={busy !== null} className="btn btn-danger btn-sm">
            {busy === "cancel" ? "Annulation en cours…" : "Annuler cette séance"}
          </button>
        </form>
      ) : null}

      <div className="space-y-2">
        <StatusMessage feedback={feedback} />
        {canRetry ? (
          <button
            type="button"
            onClick={() => void retryNotification()}
            disabled={busy !== null}
            className="btn btn-primary btn-sm"
          >
            {busy === "retry" ? "Envoi en cours…" : "Réessayer l’envoi de l’e-mail"}
          </button>
        ) : null}
      </div>

      {canManageSlots ? (
        <div className="border-t border-brand-line pt-4">
          <h3 className="text-sm font-bold text-slate-700">Créneau hebdomadaire</h3>
          <p className="mt-1 text-sm text-slate-600">
            Cette séance revient chaque semaine. Pour l’arrêter définitivement, supprimez le créneau.
          </p>
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            disabled={busy !== null}
            className="btn btn-ghost btn-sm mt-3 border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            Supprimer ce créneau
          </button>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
          Fermer
        </button>
      </div>

      <ConfirmDialog
        open={confirm === "cancel"}
        title="Annuler cette séance ?"
        message={
          <>
            <p>
              <strong>{sessionLabel}</strong>
            </p>
            <p className="mt-2">Motif : {trimmedReason}</p>
            <p className="mt-2">
              {notify
                ? memberCount > 0
                  ? `Un e-mail sera envoyé à ${memberCount} ${plural(memberCount, "adhérent", "adhérents")}.`
                  : "Aucun adhérent n’est inscrit à cette activité : aucun e-mail ne partira."
                : "Aucun e-mail ne sera envoyé aux adhérents."}
            </p>
          </>
        }
        confirmLabel="Oui, annuler la séance"
        cancelLabel="Non, revenir"
        tone="danger"
        busy={busy === "cancel"}
        onConfirm={() => void cancelSession()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "restore"}
        title="Rétablir cette séance ?"
        message={
          <>
            <p>
              <strong>{sessionLabel}</strong> sera de nouveau affichée comme maintenue sur le site.
            </p>
            <p className="mt-2">Les adhérents déjà prévenus de l’annulation ne recevront pas de nouvel e-mail.</p>
          </>
        }
        confirmLabel="Oui, rétablir"
        cancelLabel="Non, revenir"
        busy={busy === "restore"}
        onConfirm={() => void restoreSession()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Supprimer ce créneau ?"
        message={
          <>
            <p>
              Le créneau <strong>{entry.disciplineName}, {entry.dayLabel.split(" ")[0]?.toLowerCase()}, {entryTimeLabel(entry)}</strong>{" "}
              disparaîtra de <strong>toutes les semaines</strong>, du site et du bulletin d’adhésion.
            </p>
            <p className="mt-2">Les annulations déjà enregistrées pour ce créneau seront effacées.</p>
          </>
        }
        confirmLabel="Oui, supprimer le créneau"
        cancelLabel="Non, le garder"
        tone="danger"
        busy={busy === "delete"}
        onConfirm={() => void deleteSlot()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default function PlanningSessionDialog({ entry, color, ...rest }: PlanningSessionDialogProps) {
  return (
    <PlanningModal
      open={entry !== null}
      title={entry?.disciplineName ?? ""}
      subtitle={entry ? `Séance · ${entry.dayLabel}` : undefined}
      accent={
        entry
          ? entry.cancelled
            ? { bg: "#fdecef", fg: "#b4233f" }
            : { bg: color.bg, fg: color.fg }
          : undefined
      }
      onClose={rest.onClose}
    >
      {entry ? <SessionContent key={entry.id} entry={entry} {...rest} /> : null}
    </PlanningModal>
  );
}
