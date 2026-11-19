"use client";

import { useState } from "react";
import type { DossierPhaseAction } from "@/lib/dossier-workflow";

type OtherActionsProps = {
  backAction: DossierPhaseAction | null;
  canRequestDocument: boolean;
  hasEmail: boolean;
  busy: boolean;
  onBack: () => void;
  onRequestDocument: (documentLabel: string) => Promise<boolean>;
  onReject: () => void;
};

/** Actions rares ou risquées, volontairement rangées à part de l’action principale. */
export default function DossierOtherActions({
  backAction,
  canRequestDocument,
  hasEmail,
  busy,
  onBack,
  onRequestDocument,
  onReject,
}: OtherActionsProps) {
  const [label, setLabel] = useState("certificat médical");
  const [sending, setSending] = useState(false);

  async function sendRequest() {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const sent = await onRequestDocument(trimmed);
      if (sent) setLabel("certificat médical");
    } finally {
      setSending(false);
    }
  }

  return (
    <details className="group rounded-2xl border border-brand-line bg-white">
      <summary className="flex min-h-12 list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
        Autres actions
        <span aria-hidden="true" className="text-lg font-bold text-brand-blue transition group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="space-y-5 border-t border-brand-line p-4">
        {backAction ? (
          <div>
            <button type="button" disabled={busy} onClick={onBack} className="btn btn-ghost btn-sm">
              {backAction.label}
            </button>
            <p className="mt-1 text-sm text-slate-600">{backAction.hint}</p>
          </div>
        ) : null}

        {canRequestDocument ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-900">Demander une pièce à l’adhérent</p>
            {hasEmail ? (
              <>
                <p className="text-sm text-slate-600">
                  L’adhérent reçoit un e-mail avec un lien sécurisé pour déposer le document.
                </p>
                <label className="field-label">
                  Pièce demandée
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    disabled={busy || sending}
                    placeholder="Ex. certificat médical"
                    className="field"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || sending || !label.trim()}
                  onClick={() => void sendRequest()}
                  className="btn btn-outline btn-sm"
                >
                  {sending ? "Envoi…" : "Envoyer la demande par e-mail"}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Ce dossier n’a pas d’adresse e-mail : ajoutez-en une dans « Coordonnées » pour pouvoir envoyer
                la demande.
              </p>
            )}
          </div>
        ) : null}

        <div className="border-t border-brand-line pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="btn btn-ghost btn-sm border-rose-300 text-rose-700 hover:bg-rose-50"
          >
            Refuser ce dossier
          </button>
          <p className="mt-1 text-sm text-slate-600">
            À utiliser si la demande ne peut pas être acceptée. Une confirmation vous sera demandée.
          </p>
        </div>
      </div>
    </details>
  );
}
