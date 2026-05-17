"use client";

import { useRef, useState } from "react";
import type { ApplicationDossierPhase, PaymentMethod, RegistrationApplication } from "@/lib/club-data";
import {
  PAYMENT_METHOD_OPTIONS,
  PROCESSING_PHASE_DESCRIPTIONS,
  PROCESSING_PHASE_LABELS,
  getDossierProcessingPhase,
  paymentMethodLabel,
  type DossierProcessingPhase,
} from "@/lib/dossier-workflow";

type UpdatePayload = {
  status?: RegistrationApplication["status"];
  dossierPhase?: ApplicationDossierPhase;
  trialAttended?: boolean;
  paymentStatus?: RegistrationApplication["paymentStatus"];
  paymentMethod?: RegistrationApplication["paymentMethod"];
};

type DossierPanelProps = {
  application: RegistrationApplication;
  disciplineName?: string;
  onUpdate: (applicationId: string, payload: UpdatePayload) => Promise<void>;
  onRequestDocument: (applicationId: string) => Promise<void>;
  onValidateEspace: (applicationId: string) => Promise<void>;
  onReject: (applicationId: string) => Promise<void>;
  onMessage: (text: string) => void;
};

function PhaseStepper({ current }: { current: DossierProcessingPhase }) {
  const steps: DossierProcessingPhase[] = [1, 2, 3, 4, 5];
  return (
    <ol className="grid grid-cols-2 gap-1 md:flex md:flex-row md:gap-2">
      {steps.map((step) => {
        const isDone = step < current;
        const isCurrent = step === current;
        return (
          <li
            key={step}
            className={`flex min-w-0 flex-1 flex-col rounded-lg border px-1.5 py-2 text-center md:px-2 ${
              isCurrent
                ? "border-cyan-400 bg-cyan-50"
                : isDone
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <span
              className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                isCurrent
                  ? "bg-cyan-600 text-white"
                  : isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-300 text-slate-700"
              }`}
            >
              {isDone ? "✓" : step}
            </span>
            <span className="mt-1 text-[9px] font-semibold leading-tight text-slate-800 md:text-xs">
              {PROCESSING_PHASE_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ApplicantBlock({ application }: { application: RegistrationApplication }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coordonnées</p>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Nom</dt>
          <dd className="font-medium text-slate-900">{application.fullName}</dd>
        </div>
        <div>
          <dt className="text-slate-500">E-mail</dt>
          <dd className="font-medium text-slate-900">{application.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Téléphone</dt>
          <dd className="font-medium text-slate-900">{application.phone || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Adresse</dt>
          <dd className="font-medium text-slate-900">{application.address?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Code postal</dt>
          <dd className="font-medium text-slate-900">{application.postalCode?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ville</dt>
          <dd className="font-medium text-slate-900">{application.city?.trim() || "—"}</dd>
        </div>
      </dl>
      {application.motivation ? (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-medium text-slate-500">Motivation : </span>
          {application.motivation}
        </p>
      ) : null}
    </div>
  );
}

function DocumentsBlock({
  applicationId,
  documents,
  canUpload,
  onMessage,
}: {
  applicationId: string;
  documents: RegistrationApplication["documents"];
  canUpload: boolean;
  onMessage: (text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docLabel, setDocLabel] = useState("");

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (docLabel.trim()) {
        formData.append("label", docLabel.trim());
      }
      const response = await fetch(`/api/club/applications/${applicationId}/documents`, {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as { message?: string };
      if (response.ok) {
        onMessage(body.message ?? "Pièce jointe ajoutée.");
        window.location.reload();
      } else {
        onMessage(body.message ?? "Échec de l'envoi.");
      }
    } finally {
      setUploading(false);
      setDocLabel("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pièces jointes</p>
      {documents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Aucune pièce jointe déposée pour le moment.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {documents.map((doc) => (
            <li
              key={`${doc.url}-${doc.uploadedAt}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-900">{doc.name}</span>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-cyan-700 underline"
              >
                Ouvrir
              </a>
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-600">
            Déposer une pièce pour le candidat (scan, photo, document papier…)
          </p>
          <input
            type="text"
            value={docLabel}
            onChange={(e) => setDocLabel(e.target.value)}
            placeholder="Libellé (ex. certificat médical)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="max-w-full text-sm text-slate-700"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            {uploading ? <span className="text-xs text-slate-500">Envoi en cours…</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TrialBadge({
  trialAttended,
  onToggle,
  disabled,
}: {
  trialAttended: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase text-amber-900">Essai</p>
        <p className="text-sm text-amber-950">
          {trialAttended ? "Essai réalisé" : "Essai pas encore réalisé"}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-50"
      >
        Marquer comme {trialAttended ? "non réalisé" : "réalisé"}
      </button>
    </div>
  );
}

export default function DossierPanel({
  application,
  disciplineName,
  onUpdate,
  onRequestDocument,
  onValidateEspace,
  onReject,
  onMessage,
}: DossierPanelProps) {
  const phase = getDossierProcessingPhase(application);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(application.paymentMethod || "");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  if (application.status === "rejected") {
    return (
      <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Ce dossier a été refusé.</p>
    );
  }

  const canUploadDocuments = phase >= 3 && phase < 5;

  return (
    <div className="space-y-4">
      <PhaseStepper current={phase} />
      <p className="text-sm text-slate-600">{PROCESSING_PHASE_DESCRIPTIONS[phase]}</p>

      <ApplicantBlock application={application} />
      <DocumentsBlock
        applicationId={application.id}
        documents={application.documents}
        canUpload={canUploadDocuments}
        onMessage={onMessage}
      />

      <TrialBadge
        trialAttended={application.trialAttended}
        disabled={busy || phase === 5}
        onToggle={() =>
          void run(() =>
            onUpdate(application.id, { trialAttended: !application.trialAttended })
          )
        }
      />

      {phase === 1 ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-800">
            Dossier reçu. Passez à la validation de l&apos;espace membre Clerk avant de traiter les pièces.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() =>
                onUpdate(application.id, { dossierPhase: "espace_validation", status: "pending" })
              )
            }
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Passer à la validation de l&apos;espace
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Refuser ce dossier et supprimer le compte Clerk ?")) {
                void run(() => onReject(application.id));
              }
            }}
            className="block text-xs font-medium text-rose-600 underline disabled:opacity-50"
          >
            Refuser le dossier
          </button>
        </div>
      ) : null}

      {phase === 2 ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm text-violet-950">
            <p>
              <strong>Compte Clerk :</strong>{" "}
              {application.clerkUserId ? "créé (en attente d'activation)" : "absent"}
            </p>
            {disciplineName ? (
              <p className="mt-1">
                <strong>Activité :</strong> {disciplineName}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-violet-800">
              Validez pour autoriser la connexion à l&apos;espace membre. Les pièces seront traitées à l&apos;étape
              suivante. En cas de refus, le compte Clerk sera supprimé.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !application.clerkUserId}
              onClick={() => void run(() => onValidateEspace(application.id))}
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Valider l&apos;espace membre
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => onUpdate(application.id, { dossierPhase: "reception", status: "pending" }))
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Revenir à la réception
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Refuser ce dossier et supprimer le compte Clerk ?")) {
                  void run(() => onReject(application.id));
                }
              }}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50"
            >
              Refuser
            </button>
          </div>
        </div>
      ) : null}

      {phase === 3 ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-800">
            L&apos;espace membre est actif. Contrôlez les pièces jointes.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  onUpdate(application.id, {
                    dossierPhase: "payment",
                    status: "approved",
                  })
                )
              }
              className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Pièces jointes vérifiées
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onRequestDocument(application.id))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              Demander une pièce
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => onUpdate(application.id, { dossierPhase: "espace_validation", status: "pending" }))
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Revenir à la validation de l&apos;espace
            </button>
          </div>
        </div>
      ) : null}

      {phase === 4 ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-800">Enregistrer le paiement reçu</p>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Mode de paiement
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Choisir…</option>
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!paymentMethod) {
                  onMessage("Choisissez un mode de paiement avant de valider.");
                  return;
                }
                void run(() =>
                  onUpdate(application.id, {
                    dossierPhase: "finalized",
                    status: "approved",
                    paymentStatus: "paid",
                    paymentMethod,
                  })
                );
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Paiement reçu — finaliser
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onRequestDocument(application.id))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              Demander une pièce
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  onUpdate(application.id, {
                    dossierPhase: "documents",
                    status: "pending",
                    paymentStatus: "unpaid",
                  })
                )
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Revenir à la vérification des pièces
            </button>
          </div>
        </div>
      ) : null}

      {phase === 5 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Dossier finalisé</p>
          <p className="mt-1">
            Paiement enregistré ({paymentMethodLabel(application.paymentMethod)}). Adhésion active sur Clerk.
          </p>
        </div>
      ) : null}
    </div>
  );
}
