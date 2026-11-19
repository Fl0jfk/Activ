"use client";

import { useEffect, useId, useRef, useState } from "react";
import { StatusMessage, type Feedback } from "@/components/bureau-ui";
import type { BroadcastRecipient } from "@/lib/broadcast-types";

type BroadcastReviewDialogProps = {
  audienceLabel: string;
  recipients: BroadcastRecipient[];
  subject: string;
  message: string;
  /** Envoi à tout le monde : case de confirmation obligatoire. */
  requireConfirmation: boolean;
  sending: boolean;
  testing: boolean;
  feedback: Feedback;
  onSend: () => void;
  onSendTest: () => void;
  onClose: () => void;
};

/**
 * Fenêtre de relecture avant un envoi. À monter uniquement quand elle doit s'afficher :
 * l'état (case cochée) repart ainsi de zéro à chaque ouverture.
 */
export default function BroadcastReviewDialog({
  audienceLabel,
  recipients,
  subject,
  message,
  requireConfirmation,
  sending,
  testing,
  feedback,
  onSend,
  onSendTest,
  onClose,
}: BroadcastReviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const confirmId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const busy = sending || testing;
  const count = recipients.length;
  const plural = count > 1 ? "s" : "";
  const canSend = !busy && (!requireConfirmation || confirmed);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!sending) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !sending) onClose();
      }}
      className="m-auto w-[min(680px,94vw)] rounded-3xl border-0 p-0 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)] backdrop:bg-slate-900/50"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold text-slate-900">
              Relisez avant d’envoyer
            </h2>
            <p className="mt-1 text-[15px] leading-6 text-slate-700">
              Une fois envoyé, un message ne peut plus être retiré.
            </p>
          </div>

          <section aria-label="Destinataires">
            <p className="text-sm font-semibold text-slate-600">{audienceLabel}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {count} destinataire{plural}
            </p>
            <details className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold text-brand-blue-dark">
                Voir la liste des destinataires
              </summary>
              <ul className="max-h-52 divide-y divide-slate-200 overflow-y-auto pb-2">
                {recipients.map((recipient) => (
                  <li key={recipient.email} className="py-2">
                    <span className="block text-sm font-semibold text-slate-900">
                      {recipient.name}
                    </span>
                    {recipient.name !== recipient.email ? (
                      <span className="block break-all text-sm text-slate-600">
                        {recipient.email}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section aria-label="Message tel que le recevront les destinataires">
            <p className="text-sm font-semibold text-slate-600">
              Le message tel que vos destinataires le recevront
            </p>
            <div className="mt-2 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <p className="break-words text-base font-extrabold text-slate-900">{subject}</p>
              <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-800">
                {message}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                —<br />
                L’équipe Activ’
              </p>
            </div>
          </section>

          {requireConfirmation ? (
            <label
              htmlFor={confirmId}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"
            >
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy}
                className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue"
              />
              <span className="text-[15px] font-semibold leading-6 text-amber-950">
                Je confirme l’envoi à {count} personne{plural}
              </span>
            </label>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-slate-200 p-4 sm:px-6">
          <div aria-live="polite">
            <StatusMessage feedback={feedback} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={sending} className="btn btn-ghost btn-sm">
              Modifier le message
            </button>
            <button
              type="button"
              onClick={onSendTest}
              disabled={busy}
              className="btn btn-outline btn-sm"
            >
              {testing ? "Envoi du test…" : "M’envoyer un test"}
            </button>
            <button type="button" onClick={onSend} disabled={!canSend} className="btn btn-primary">
              {sending ? "Envoi en cours…" : `Envoyer à ${count} personne${plural}`}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
