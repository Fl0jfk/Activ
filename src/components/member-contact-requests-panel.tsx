"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, ConfirmDialog, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import type {
  MemberContactChangeRequest,
  RegistrationApplication,
} from "@/lib/club-data";
import { formatDateFr } from "@/lib/dossier-format";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import {
  contactValuesFromApplication,
  type MemberContactValues,
} from "@/lib/member-contact";

type MemberContactRequestsPanelProps = {
  requests: MemberContactChangeRequest[];
  applications: RegistrationApplication[];
};

const FIELD_LABELS: Record<keyof MemberContactValues, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  email: "E-mail",
  phone: "Téléphone",
  address: "Adresse",
  postalCode: "Code postal",
  city: "Ville",
};

function requestValues(
  request: MemberContactChangeRequest,
): MemberContactValues {
  return {
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    phone: request.phone,
    address: request.address,
    postalCode: request.postalCode,
    city: request.city,
  };
}

export default function MemberContactRequestsPanel({
  requests,
  applications,
}: MemberContactRequestsPanelProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<{ id: string; text: string } | null>(null);
  const [doneFeedback, setDoneFeedback] = useState<Feedback>(null);

  if (requests.length === 0 && !doneFeedback) {
    return null;
  }

  async function review(
    request: MemberContactChangeRequest,
    action: "approve" | "reject",
    reason?: string,
  ) {
    setBusyId(request.id);
    setErrorFor(null);
    setDoneFeedback(null);
    try {
      const result = await fetchJson(
        `/api/club/contact-change-requests/${request.id}`,
        jsonInit("POST", { action, reason }),
      );
      if (!result.ok) {
        setErrorFor({
          id: request.id,
          text: result.message || "L’action n’a pas pu être effectuée. Réessayez dans un instant.",
        });
        return;
      }
      const name = [request.firstName, request.lastName].filter(Boolean).join(" ") || "l’adhérent";
      setDoneFeedback({
        tone: "success",
        text:
          action === "approve"
            ? `Les nouvelles coordonnées de ${name} sont enregistrées.`
            : `La demande de ${name} a été refusée.`,
      });
      setRejectingId(null);
      setRejectReason("");
      startRefresh(() => router.refresh());
    } finally {
      setBusyId(null);
      setConfirmApproveId(null);
    }
  }

  function startApprove(request: MemberContactChangeRequest, emailChanges: boolean) {
    if (emailChanges) {
      setConfirmApproveId(request.id);
    } else {
      void review(request, "approve");
    }
  }

  const confirmRequest = requests.find((request) => request.id === confirmApproveId) ?? null;

  return (
    <SectionCard
      id="modifications"
      eyebrow="À traiter"
      title="Demandes de modification de coordonnées"
      description="Des adhérents demandent la correction de leurs coordonnées. Vérifiez la demande puis validez : le dossier et l’adresse de connexion sont mis à jour ensemble."
      action={
        requests.length > 0 ? (
          <Badge tone="orange">
            {requests.length} en attente
          </Badge>
        ) : null
      }
    >
      <div className="space-y-4">
        <StatusMessage feedback={doneFeedback} />

        <ul className="space-y-3">
          {requests.map((request) => {
            const application = applications.find((entry) => entry.id === request.applicationId);
            const current = application ? contactValuesFromApplication(application) : null;
            const next = requestValues(request);
            const changes = (Object.keys(FIELD_LABELS) as (keyof MemberContactValues)[])
              .filter(
                (key) =>
                  !current || current[key].trim().toLowerCase() !== next[key].trim().toLowerCase(),
              )
              .map((key) => ({
                key,
                label: FIELD_LABELS[key],
                before: current?.[key]?.trim() || "—",
                after: next[key].trim() || "—",
              }));
            const isBusy = busyId === request.id;
            const emailChanges = changes.some((change) => change.key === "email");

            return (
              <li key={request.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-extrabold text-slate-900">
                    {[next.firstName, next.lastName].filter(Boolean).join(" ") || "Adhérent"}
                    {application ? (
                      <span className="ml-2 text-sm font-normal text-slate-600">
                        Dossier du {formatDateFr(application.createdAt)}
                      </span>
                    ) : (
                      <span className="ml-2 text-sm font-semibold text-rose-700">Dossier introuvable</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">Demande du {formatDateFr(request.createdAt)}</p>
                </div>

                {changes.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-700">
                    Les coordonnées demandées sont déjà celles du dossier.
                  </p>
                ) : (
                  <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    {changes.map((change) => (
                      <div key={change.key} className="min-w-0 rounded-xl bg-white px-3 py-2">
                        <dt className="text-sm font-semibold text-slate-600">{change.label}</dt>
                        <dd className="mt-0.5 min-w-0 text-sm text-slate-900">
                          <span className="text-break block text-slate-500 line-through">{change.before}</span>
                          <span className="text-break mt-0.5 block font-semibold">{change.after}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {errorFor?.id === request.id ? (
                  <StatusMessage feedback={{ tone: "error", text: errorFor.text }} className="mt-3" />
                ) : null}

                {rejectingId === request.id ? (
                  <div className="mt-3 space-y-3">
                    <label className="field-label">
                      Motif du refus (facultatif)
                      <textarea
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        rows={2}
                        className="field"
                        placeholder="Ex. adresse incomplète, justificatif manquant…"
                        disabled={isBusy}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void review(request, "reject", rejectReason)}
                        disabled={isBusy}
                        className="btn btn-danger btn-sm"
                      >
                        {isBusy ? "Envoi…" : "Confirmer le refus"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        disabled={isBusy}
                        className="btn btn-ghost btn-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startApprove(request, emailChanges)}
                      disabled={isBusy || !application}
                      className="btn btn-primary btn-sm"
                    >
                      {isBusy ? "Validation…" : "Valider la modification"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(request.id);
                        setRejectReason("");
                      }}
                      disabled={isBusy}
                      className="btn btn-ghost btn-sm border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      Refuser
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={confirmRequest !== null}
        title="Valider le changement d’adresse e-mail ?"
        message="L’adresse e-mail du dossier sera remplacée, et l’adhérent devra se connecter à son espace avec la nouvelle adresse."
        confirmLabel="Valider la modification"
        busy={busyId !== null}
        onConfirm={() => confirmRequest && void review(confirmRequest, "approve")}
        onCancel={() => setConfirmApproveId(null)}
      />
    </SectionCard>
  );
}
