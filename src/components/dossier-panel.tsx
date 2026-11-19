"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/bureau-ui";
import DocumentsSection, { documentsSummary } from "@/components/dossier-documents";
import DossierOtherActions from "@/components/dossier-other-actions";
import {
  ActivitiesSection,
  BulletinSection,
  ContactSection,
  DossierSection,
  MemberMessageSection,
  TrialSection,
  bulletinSummary,
  contactSummary,
} from "@/components/dossier-sections";
import DossierStepper from "@/components/dossier-stepper";
import PaymentReceiptLink from "@/components/payment-receipt-link";
import type { ClubApplicationActions } from "@/hooks/useClubApplicationActions";
import type { PaymentMethod, RegistrationApplication } from "@/lib/club-data";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";
import type { DisciplineOption } from "@/lib/discipline-options";
import { formatDateFr } from "@/lib/dossier-format";
import {
  PAYMENT_METHOD_OPTIONS,
  getApplicationDisciplineNames,
  getDossierProcessingPhase,
  getDossierStep,
  getPhaseAction,
  paymentMethodLabel,
  type DossierPhaseAction,
} from "@/lib/dossier-workflow";

export type { ApplicationUpdatePayload as UpdatePayload };

type DossierPanelProps = {
  application: RegistrationApplication;
  /** Activités actives du club, pour modifier celles du dossier. */
  disciplines: DisciplineOption[];
  actions: ClubApplicationActions;
};

type PendingConfirm =
  | { type: "step"; action: DossierPhaseAction }
  | { type: "reject" }
  | null;

/** Lien à transmettre à la main quand l’e-mail n’a pas pu partir (remplace l’ancienne fenêtre « prompt »). */
function SecureLinkBox({ link, kind, onClose }: { link: string; kind: "document" | "bulletin"; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-blue/30 bg-brand-blue/5 p-4">
      <label className="field-label">
        {kind === "document" ? "Lien de dépôt à transmettre à l’adhérent" : "Lien de revalidation à transmettre à l’adhérent"}
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="field"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void copy()} className="btn btn-primary btn-sm">
          Copier le lien
        </button>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
          Fermer
        </button>
        {copied ? <span className="text-sm font-semibold text-brand-green-dark">Lien copié.</span> : null}
      </div>
    </div>
  );
}

export default function DossierPanel({ application, disciplines, actions }: DossierPanelProps) {
  const phase = getDossierProcessingPhase(application);
  const step = getDossierStep(application);
  const isPaper = application.origin === "paper";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(application.paymentMethod || "");
  const [amountInput, setAmountInput] = useState(() => {
    const known = application.amountPaid ?? application.membershipBulletin?.grandTotal;
    return typeof known === "number" && known > 0 ? String(known).replace(".", ",") : "";
  });
  const [methodError, setMethodError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [rejectReason, setRejectReason] = useState("");

  const disabled = busy || actions.refreshing;
  const id = application.id;
  const nextAction = getPhaseAction(application, "next");
  const backAction = getPhaseAction(application, "back");
  const secureLink = actions.secureLinkFor(id);

  async function withBusy(task: () => Promise<unknown>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  async function executeStep(action: DossierPhaseAction) {
    await withBusy(async () => {
      if (action.kind === "validate_espace") {
        await actions.validateEspace(id, action.successMessage);
        return;
      }
      const payload: ApplicationUpdatePayload | undefined =
        action.kind === "finalize"
          ? { ...action.payload, paymentMethod, ...(parsedAmount() !== null ? { amountPaid: parsedAmount() } : {}) }
          : action.payload;
      if (payload) {
        await actions.updateApplication(id, payload, action.successMessage);
      }
    });
    setConfirm(null);
  }

  /** Montant saisi en euros (virgule acceptée), `null` si vide ou invalide. */
  function parsedAmount(): number | null {
    const value = Number(amountInput.trim().replace(/\s/g, "").replace(",", "."));
    return amountInput.trim() && Number.isFinite(value) && value >= 0 ? value : null;
  }

  function requestStep(action: DossierPhaseAction) {
    if (action.kind === "finalize" && !paymentMethod) {
      setMethodError("Choisissez le mode de paiement reçu avant de finaliser.");
      return;
    }
    if (action.kind === "finalize" && amountInput.trim() && parsedAmount() === null) {
      setMethodError("Le montant reçu n’est pas valide. Exemple : 190 ou 190,50.");
      return;
    }
    setMethodError("");
    if (action.confirm) {
      setConfirm({ type: "step", action });
    } else {
      void executeStep(action);
    }
  }

  async function executeReject() {
    await withBusy(() =>
      actions.rejectApplication(id, Boolean(application.clerkUserId), {
        reason: rejectReason,
        force: phase === 5,
      }),
    );
    setConfirm(null);
    setRejectReason("");
  }

  if (application.status === "rejected") {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Ce dossier a été refusé. Il n’apparaît plus dans les dossiers en cours.
        </p>
        {application.clerkUserId ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
              Le compte de connexion de cette personne existe encore : elle ne pourra pas se réinscrire avec la même
              adresse e-mail tant qu’il n’est pas supprimé.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void withBusy(() => actions.rejectApplication(id, true))}
              className="btn btn-outline btn-sm mt-2"
            >
              Supprimer le compte de connexion
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (application.status === "cancelled") {
    return (
      <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
        Cet adhérent est désinscrit : il ne reçoit plus les messages du club ni les alertes de renouvellement.
      </p>
    );
  }

  const activityNames = getApplicationDisciplineNames(application, disciplines);
  const confirmStep = confirm?.type === "step" ? confirm.action : null;
  const licenseEnd = application.licenseEndDate ? formatDateFr(application.licenseEndDate, "long") : "";

  return (
    <div className="space-y-5">
      <DossierStepper current={phase} />

      {step === "missing_document" ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          Une pièce a été demandée à l’adhérent. Le dossier reprendra dès qu’il l’aura déposée.
        </p>
      ) : null}

      {nextAction ? (
        <section className="rounded-2xl border-2 border-brand-blue/30 bg-brand-blue/5 p-4">
          <p className="text-sm font-bold text-brand-blue-dark">À faire maintenant</p>
          <p className="mt-1 text-sm text-slate-700">{nextAction.hint}</p>
          {nextAction.kind === "finalize" ? (
            <div className="mt-3 max-w-sm">
              <label className="field-label">
                Mode de paiement reçu
                <select
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value as PaymentMethod);
                    setMethodError("");
                  }}
                  disabled={disabled}
                  className="field"
                  aria-invalid={methodError ? true : undefined}
                >
                  <option value="">Choisir…</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label mt-3">
                Montant reçu en € (facultatif)
                <input
                  value={amountInput}
                  onChange={(event) => {
                    setAmountInput(event.target.value);
                    setMethodError("");
                  }}
                  disabled={disabled}
                  inputMode="decimal"
                  placeholder="Ex. 190"
                  className="field"
                />
              </label>
              <p className="mt-1 text-sm text-slate-600">
                Ce montant figure sur l’attestation. Laissez vide pour utiliser le total du bulletin.
              </p>
              {methodError ? (
                <p role="alert" className="mt-1 text-sm font-semibold text-rose-700">
                  {methodError}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={disabled || (nextAction.kind === "validate_espace" && !application.clerkUserId)}
            onClick={() => requestStep(nextAction)}
            className="btn btn-primary mt-4 w-full sm:w-auto"
          >
            {nextAction.label}
          </button>
          {nextAction.kind === "validate_espace" && !application.clerkUserId ? (
            <p className="mt-2 text-sm font-semibold text-amber-800">
              Aucun compte de connexion n’est lié à ce dossier : l’espace ne peut pas être validé.
            </p>
          ) : null}
        </section>
      ) : phase === 5 ? (
        <section className="rounded-2xl border-2 border-brand-green/30 bg-brand-green/10 p-4">
          <p className="text-[15px] font-bold text-brand-green-dark">Dossier finalisé</p>
          <p className="mt-1 text-sm text-slate-700">
            Paiement enregistré ({paymentMethodLabel(application.paymentMethod)}).
            {licenseEnd ? ` Licence valable jusqu’au ${licenseEnd}.` : ""}{" "}
            {isPaper ? "Dossier papier traité." : "L’adhésion est active."}
          </p>
          {application.receiptNumber ? (
            <p className="mt-1 text-sm text-slate-600">
              Attestation n° {application.receiptNumber}
              {application.paidAt ? ` du ${formatDateFr(application.paidAt, "long")}` : ""}.
            </p>
          ) : null}
          {application.paidAt || application.receiptSentAt ? (
            <p
              className={`mt-1 text-sm font-semibold ${application.receiptSentAt ? "text-brand-green-dark" : "text-amber-800"}`}
            >
              {application.receiptSentAt
                ? `Attestation envoyée à l’adhérent le ${formatDateFr(application.receiptSentAt, "long")}.`
                : application.email?.trim()
                  ? "L’attestation n’a pas encore été envoyée à l’adhérent."
                  : "Aucune adresse e-mail : l’attestation n’a pas pu être envoyée."}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <PaymentReceiptLink applicationId={id} className="btn btn-primary btn-sm">
              Télécharger l’attestation de paiement
            </PaymentReceiptLink>
            <button
              type="button"
              disabled={disabled || !application.email?.trim()}
              onClick={() => void withBusy(() => actions.resendReceipt(id))}
              className="btn btn-outline btn-sm"
            >
              Renvoyer l’attestation
            </button>
          </div>
        </section>
      ) : null}

      {secureLink ? (
        <SecureLinkBox link={secureLink.link} kind={secureLink.kind} onClose={actions.dismissSecureLink} />
      ) : null}

      <div className="space-y-2">
        <DossierSection title="Coordonnées" summary={contactSummary(application)}>
          <ContactSection
            application={application}
            disabled={disabled}
            onUpdate={(payload, message) => actions.updateApplication(id, payload, message)}
          />
        </DossierSection>
        {disciplines.length > 0 ? (
          <DossierSection title="Activités" summary={activityNames.join(", ") || "Aucune activité"}>
            <ActivitiesSection
              application={application}
              disciplines={disciplines}
              disabled={disabled}
              onUpdate={(payload, message) => actions.updateApplication(id, payload, message)}
            />
          </DossierSection>
        ) : null}
        <DossierSection title="Bulletin d’adhésion" summary={bulletinSummary(application)}>
          <BulletinSection
            application={application}
            busy={disabled}
            onRequestRevalidation={() => void withBusy(() => actions.requestBulletinRevalidation(id))}
          />
        </DossierSection>
        <DossierSection
          title="Pièces"
          summary={documentsSummary(application.documents.length)}
          defaultOpen={phase === 3}
        >
          <DocumentsSection
            applicationId={id}
            documents={application.documents}
            canUpload={phase >= 3 && phase < 5}
            showReceipt={application.paymentStatus === "paid" && phase !== 5}
            disabled={disabled}
            onUpload={(file, label) => actions.uploadDocument(id, file, label)}
          />
        </DossierSection>
        <DossierSection
          title="Message à l’adhérent"
          summary={application.memberMessage?.trim() ? "Un message est affiché à l’adhérent" : "Aucun message"}
        >
          <MemberMessageSection
            application={application}
            disabled={disabled}
            onUpdate={(payload, message) => actions.updateApplication(id, payload, message)}
          />
        </DossierSection>
        <DossierSection
          title="Essai"
          summary={application.trialAttended ? "Essai réalisé" : "Essai pas encore réalisé"}
        >
          <TrialSection
            trialAttended={application.trialAttended}
            disabled={disabled || phase === 5}
            onToggle={() =>
              void withBusy(() =>
                actions.updateApplication(
                  id,
                  { trialAttended: !application.trialAttended },
                  application.trialAttended ? "Essai marqué comme non réalisé." : "Essai marqué comme réalisé.",
                ),
              )
            }
          />
        </DossierSection>
      </div>

      <DossierOtherActions
        backAction={backAction}
        canRequestDocument={phase >= 3 && phase < 5}
        hasEmail={Boolean(application.email?.trim())}
        busy={disabled}
        onBack={() => {
          if (!backAction) return;
          if (backAction.confirm) {
            setConfirm({ type: "step", action: backAction });
          } else {
            void executeStep(backAction);
          }
        }}
        onRequestDocument={(label) => actions.requestDocument(id, label)}
        onReject={() => setConfirm({ type: "reject" })}
      />

      <ConfirmDialog
        open={confirmStep !== null}
        title={confirmStep?.confirm?.title ?? ""}
        message={
          confirmStep ? (
            <>
              <p>{confirmStep.confirm?.message}</p>
              {confirmStep.kind === "finalize" ? (
                <p className="mt-2 font-semibold">Mode de paiement : {paymentMethodLabel(paymentMethod)}.</p>
              ) : null}
            </>
          ) : null
        }
        confirmLabel={confirmStep?.confirm?.confirmLabel ?? "Confirmer"}
        tone={confirmStep?.confirm?.tone ?? "primary"}
        busy={busy}
        onConfirm={() => confirmStep && void executeStep(confirmStep)}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.type === "reject"}
        title="Refuser ce dossier ?"
        message={
          <>
            <p>
              Le dossier de {application.fullName} sera marqué comme refusé et ne sera plus dans les dossiers en
              cours (onglet « Refusés et désinscrits »).
            </p>
            {phase === 5 ? (
              <p className="mt-2 font-semibold text-rose-700">
                Ce dossier est finalisé et payé : seul le président peut le refuser. Le paiement enregistré et
                l’attestation seront annulés (un remboursement éventuel se traite hors de l’application).
              </p>
            ) : null}
            <p className="mt-2 font-semibold">
              {application.clerkUserId
                ? "Son accès à l’espace adhérent sera supprimé. Cette action est définitive depuis cet écran."
                : "Cette action est définitive depuis cet écran."}
            </p>
            {application.email?.trim() ? (
              <p className="mt-2 text-sm text-slate-600">
                Un e-mail l’informera que son dossier n’a pas pu être accepté.
              </p>
            ) : null}
          </>
        }
        confirmLabel="Refuser le dossier"
        tone="danger"
        busy={busy}
        onConfirm={() => void executeReject()}
        onCancel={() => setConfirm(null)}
      >
        <label className="field-label">
          Motif (facultatif, communiqué à l’adhérent)
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            maxLength={500}
            rows={3}
            className="field"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
