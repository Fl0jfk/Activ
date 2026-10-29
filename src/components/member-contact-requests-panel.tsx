"use client";

import { useState } from "react";
import type {
  MemberContactChangeRequest,
  RegistrationApplication,
} from "@/lib/club-data";
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MemberContactRequestsPanel({
  requests,
  applications,
}: MemberContactRequestsPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");

  if (requests.length === 0) {
    return null;
  }

  async function review(
    requestId: string,
    action: "approve" | "reject",
    reason?: string,
  ) {
    setBusyId(requestId);
    setError("");
    try {
      const response = await fetch(`/api/club/contact-change-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Action impossible.");
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      window.location.reload();
    } catch {
      setError("Action impossible. Réessayez dans un instant.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-900">Demandes de modification</h2>
        <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          {requests.length} en attente
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-700">
        Les adhérents peuvent demander la correction de leurs coordonnées. Vérifiez la demande
        puis validez : le dossier et l&apos;adresse de connexion sont mis à jour ensemble.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-900">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {requests.map((request) => {
          const application = applications.find(
            (entry) => entry.id === request.applicationId,
          );
          const current = application
            ? contactValuesFromApplication(application)
            : null;
          const next = requestValues(request);
          const changes = (Object.keys(FIELD_LABELS) as (keyof MemberContactValues)[])
            .filter(
              (key) =>
                !current ||
                current[key].trim().toLowerCase() !== next[key].trim().toLowerCase(),
            )
            .map((key) => ({
              key,
              label: FIELD_LABELS[key],
              before: current?.[key]?.trim() || "—",
              after: next[key].trim() || "—",
            }));
          const isBusy = busyId === request.id;

          return (
            <li
              key={request.id}
              className="rounded-xl border border-amber-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {[next.firstName, next.lastName].filter(Boolean).join(" ") || "Adhérent"}
                  {application ? (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      Dossier du {formatDate(application.createdAt)}
                    </span>
                  ) : (
                    <span className="ml-2 text-sm font-normal text-rose-600">
                      Dossier introuvable
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Demande du {formatDate(request.createdAt)}
                </p>
              </div>

              {changes.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Les coordonnées demandées sont déjà celles du dossier.
                </p>
              ) : (
                <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {changes.map((change) => (
                    <div
                      key={change.key}
                      className="min-w-0 rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {change.label}
                      </dt>
                      <dd className="mt-0.5 min-w-0 text-slate-900">
                        <span className="block break-words text-slate-500 line-through [overflow-wrap:anywhere]">
                          {change.before}
                        </span>
                        <span className="mt-0.5 block break-words font-medium [overflow-wrap:anywhere]">
                          {change.after}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {rejectingId === request.id ? (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Motif du refus (facultatif)
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                      placeholder="Ex. adresse incomplète, justificatif manquant…"
                      disabled={isBusy}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void review(request.id, "reject", rejectReason)
                      }
                      disabled={isBusy}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void review(request.id, "approve")}
                    disabled={isBusy || !application}
                    className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
                    className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
