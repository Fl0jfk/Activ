"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { StatusMessage } from "@/components/bureau-ui";
import { formatDateFr } from "@/components/forms/validators";
import { formatEuros } from "@/components/inscription/format";
import type { BulletinValues, StepId } from "@/components/inscription/types";
import type { MembershipActivityOption } from "@/lib/membership-activities";
import {
  MEMBERSHIP_ADHESION_FEE,
  computeMembershipTotals,
  imageRightsLabel,
  paymentPlanLabel,
} from "@/lib/membership-bulletin";

export type PreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

const WIDE_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** Les aperçus PDF intégrés ne fonctionnent pas sur la plupart des téléphones : on ne les affiche que sur grand écran. */
function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

function SummaryCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-line bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand-blue hover:bg-brand-blue/10"
          >
            Modifier<span className="sr-only"> : {title}</span>
          </button>
        ) : null}
      </div>
      <dl className="mt-1 divide-y divide-brand-line">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] font-medium text-slate-900">{children}</dd>
    </div>
  );
}

type ReviewStepProps = {
  values: BulletinValues;
  options: MembershipActivityOption[];
  signatureDataUrl: string;
  preview: PreviewState;
  onRetryPreview: () => void;
  onEdit: (step: StepId) => void;
  revalidation: boolean;
};

export default function ReviewStep({
  values,
  options,
  signatureDataUrl,
  preview,
  onRetryPreview,
  onEdit,
  revalidation,
}: ReviewStepProps) {
  const wide = useWideScreen();
  const totals = computeMembershipTotals(values.selectedSlots);
  const activityLabels = values.selectedSlots.map((id) => {
    const option = options.find((entry) => entry.id === id);
    return option ? `${option.day} ${option.time} — ${option.activity}` : id;
  });
  const editEmail = revalidation ? "identity" : "account";

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-6 text-slate-700">
        Relisez attentivement ces informations. Si tout est correct, envoyez votre dossier : le bureau recevra le bulletin
        signé et vous recevrez une copie par e-mail.
      </p>

      <h3 className="text-xl font-extrabold text-slate-900">Récapitulatif</h3>

      <SummaryCard title="Vos informations" onEdit={() => onEdit("identity")}>
        <Row label="Nom">
          {values.firstName} {values.lastName}
        </Row>
        <Row label="Né(e) le">{formatDateFr(values.birthDate)}</Row>
        <Row label="Téléphone">{values.phone}</Row>
        <Row label="Adresse">
          {values.address}, {values.postalCode} {values.city}
        </Row>
      </SummaryCard>

      <SummaryCard title="Compte et e-mail" onEdit={() => onEdit(editEmail)}>
        <Row label="Adresse e-mail">{values.email.trim().toLowerCase()}</Row>
        {!revalidation ? <Row label="Mot de passe">Celui que vous avez choisi (non affiché)</Row> : null}
      </SummaryCard>

      <SummaryCard title="Personne à prévenir" onEdit={() => onEdit("emergency")}>
        <Row label="Nom">{values.emergencyContactName}</Row>
        <Row label="Téléphone">{values.emergencyContactPhone}</Row>
      </SummaryCard>

      <SummaryCard title="Activités et paiement" onEdit={() => onEdit("activities")}>
        <Row label="Activités">
          <ul className="space-y-1">
            {activityLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </Row>
        <Row label="Total à régler">
          <strong>{formatEuros(totals.grandTotal)}</strong>
          <span className="block text-sm font-normal text-slate-600">
            Adhésion {formatEuros(MEMBERSHIP_ADHESION_FEE)} + activités {formatEuros(totals.activitiesTotal)}
          </span>
        </Row>
        <Row label="Mode de paiement">{paymentPlanLabel(values.paymentPlan)}</Row>
      </SummaryCard>

      <SummaryCard title="Engagements et signature" onEdit={() => onEdit("commitments")}>
        <Row label="Engagements">Règlement, santé, assurance et remboursement : acceptés</Row>
        <Row label="Droit à l’image">{values.imageRights ? imageRightsLabel(values.imageRights) : ""}</Row>
        <Row label="Fait à">
          {values.signedPlace}, le {formatDateFr(values.signedAt)}
        </Row>
        <Row label="Signature">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureDataUrl}
            alt="Votre signature"
            className="h-24 w-auto max-w-full rounded-lg border border-brand-line bg-white"
          />
          <button
            type="button"
            onClick={() => onEdit("signature")}
            className="mt-1 min-h-11 text-sm font-bold text-brand-blue hover:underline"
          >
            Signer à nouveau
          </button>
        </Row>
      </SummaryCard>

      <section className="rounded-2xl border border-brand-line bg-brand-cream p-4 sm:p-5" aria-labelledby="preview-title">
        <h3 id="preview-title" className="text-xl font-extrabold text-slate-900">
          Aperçu du bulletin
        </h3>
        <p className="mt-1 text-[15px] leading-6 text-slate-700">
          Vérifiez le bulletin PDF. S’il est correct, confirmez l’envoi : le bureau recevra le dossier signé et vous
          recevrez une copie par e-mail.
        </p>

        {preview.status === "loading" ? (
          <p role="status" className="mt-4 text-sm font-semibold text-slate-700">
            Préparation du PDF en cours…
          </p>
        ) : null}

        {preview.status === "error" ? (
          <div className="mt-4 space-y-3">
            <StatusMessage feedback={{ tone: "error", text: preview.message }} />
            <button type="button" onClick={onRetryPreview} className="btn btn-outline">
              Réessayer l’aperçu
            </button>
            <p className="text-sm text-slate-600">
              L’aperçu est facultatif : vous pouvez tout de même envoyer votre dossier.
            </p>
          </div>
        ) : null}

        {preview.status === "ready" ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={preview.url} target="_blank" rel="noopener" className="btn btn-outline">
                Ouvrir le PDF
              </a>
              <a href={preview.url} download="bulletin-adhesion.pdf" className="btn btn-outline">
                Télécharger le PDF
              </a>
            </div>
            {wide ? (
              <iframe
                title="Aperçu du bulletin d’adhésion"
                src={preview.url}
                className="h-[70vh] w-full rounded-xl border border-brand-line bg-white"
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
