"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge, ConfirmDialog, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import type { PaymentMethod, RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import {
  PAYMENT_METHOD_OPTIONS,
  getApplicationDisciplineNames,
  paymentMethodLabel,
} from "@/lib/dossier-workflow";
import {
  daysUntilLicenseEnd,
  formatLicenseEndDateFr,
  isLicenseExpired,
  listApplicationsNeedingLicenseRenewal,
  nextLicenseEndDate,
} from "@/lib/license-renewal";

type LicenseRenewalPanelProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
};

type PendingAction = { kind: "renew" | "cancel"; application: RegistrationApplication } | null;

export default function LicenseRenewalPanel({ disciplines, applications }: LicenseRenewalPanelProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [methodError, setMethodError] = useState("");
  const [errorFor, setErrorFor] = useState<{ id: string; text: string } | null>(null);
  const [doneFeedback, setDoneFeedback] = useState<Feedback>(null);

  const alerts = useMemo(() => listApplicationsNeedingLicenseRenewal(applications), [applications]);

  async function sendUpdate(
    application: RegistrationApplication,
    request: { url: string; method: "POST" | "PATCH"; body: Record<string, unknown> },
    successText: string,
  ) {
    setBusyId(application.id);
    setErrorFor(null);
    setDoneFeedback(null);
    try {
      const result = await fetchJson<{ warning?: string }>(request.url, jsonInit(request.method, request.body));
      if (!result.ok) {
        setErrorFor({
          id: application.id,
          text: result.message || "La mise à jour n’a pas pu être enregistrée. Réessayez dans un instant.",
        });
        return;
      }
      setDoneFeedback(
        result.data?.warning
          ? { tone: "info", text: result.message || successText }
          : { tone: "success", text: result.message || successText },
      );
      startRefresh(() => router.refresh());
    } finally {
      setBusyId(null);
      setPending(null);
    }
  }

  function startRenew(application: RegistrationApplication) {
    setPaymentMethod(application.paymentMethod || "");
    setMethodError("");
    setPending({ kind: "renew", application });
  }

  function confirmPending() {
    if (!pending) return;
    const { application } = pending;
    const name = application.fullName || application.email;
    if (pending.kind === "renew") {
      if (!paymentMethod) {
        setMethodError("Choisissez le mode de paiement reçu.");
        return;
      }
      // Le serveur calcule la nouvelle date et refuse un second envoi du même renouvellement
      // (`expectedLicenseEndDate` ne correspondrait plus) : jamais deux renouvellements ni deux attestations.
      void sendUpdate(
        application,
        {
          url: `/api/club/applications/${application.id}/renew-license`,
          method: "POST",
          body: { paymentMethod, expectedLicenseEndDate: application.licenseEndDate ?? null },
        },
        `Licence de ${name} renouvelée jusqu’au ${formatLicenseEndDateFr(nextLicenseEndDate(application.licenseEndDate))}.`,
      );
      return;
    }
    void sendUpdate(
      application,
      {
        url: `/api/club/applications/${application.id}`,
        method: "PATCH",
        body: { status: "cancelled", licenseEndDate: null },
      },
      `${name} a été désinscrit(e).`,
    );
  }

  const pendingName = pending ? pending.application.fullName || pending.application.email : "";

  return (
    <SectionCard
      id="renouvellements"
      eyebrow="Bureau · Licences"
      title="Renouvellements de licences"
      description="Licences terminées ou qui se terminent dans les 30 prochains jours."
      action={alerts.length > 0 ? <Badge tone="orange">{alerts.length} à renouveler</Badge> : null}
    >
      <div className="space-y-4">
        <StatusMessage feedback={doneFeedback} />

        {alerts.length === 0 ? (
          <EmptyState>Aucune licence à renouveler dans les 30 prochains jours.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {alerts.map((app) => {
              const activities =
                getApplicationDisciplineNames(app, disciplines).join(", ") || "Activité non précisée";
              const expired = isLicenseExpired(app.licenseEndDate);
              const busy = busyId === app.id;
              const days = app.licenseEndDate ? daysUntilLicenseEnd(app.licenseEndDate) : 0;
              return (
                <li
                  key={app.id}
                  className={`rounded-2xl border bg-white p-4 ${expired ? "border-rose-200" : "border-amber-200"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-break text-base font-extrabold text-slate-900">
                        {app.fullName || app.email}
                      </p>
                      <p className="text-break mt-0.5 text-sm text-slate-600">
                        {activities}
                        {app.email ? ` · ${app.email}` : ""}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                        {expired ? (
                          <Badge tone="rose">Licence terminée</Badge>
                        ) : (
                          <Badge tone="orange">
                            {days <= 1 ? "Se termine demain ou aujourd’hui" : `Se termine dans ${days} jours`}
                          </Badge>
                        )}
                        {expired ? "Terminée le " : "Valable jusqu’au "}
                        {app.licenseEndDate ? formatLicenseEndDateFr(app.licenseEndDate) : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startRenew(app)}
                        className="btn btn-primary btn-sm"
                      >
                        Renouveler pour 1 an
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPending({ kind: "cancel", application: app })}
                        className="btn btn-ghost btn-sm border-rose-300 text-rose-700 hover:bg-rose-50"
                      >
                        Désinscrire
                      </button>
                    </div>
                  </div>
                  {errorFor?.id === app.id ? (
                    <StatusMessage feedback={{ tone: "error", text: errorFor.text }} className="mt-3" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pending?.kind === "renew"}
        title="Renouveler la licence ?"
        message={
          pending ? (
            <p>
              La licence de {pendingName} sera prolongée jusqu’au{" "}
              <strong>{formatLicenseEndDateFr(nextLicenseEndDate(pending.application.licenseEndDate))}</strong>, et le paiement
              sera enregistré comme reçu.
            </p>
          ) : null
        }
        confirmLabel="Renouveler"
        busy={busyId !== null}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        <label className="field-label">
          Mode de paiement reçu
          <select
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value as PaymentMethod);
              setMethodError("");
            }}
            className="field"
          >
            <option value="">Choisir…</option>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {methodError ? (
          <p role="alert" className="mt-1 text-sm font-semibold text-rose-700">
            {methodError}
          </p>
        ) : null}
        {paymentMethod ? (
          <p className="mt-1 text-sm text-slate-600">Paiement : {paymentMethodLabel(paymentMethod)}.</p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === "cancel"}
        title="Désinscrire cet adhérent ?"
        message={
          <>
            <p>
              {pendingName} ne fera plus partie des adhérents : il ne recevra plus les messages du club ni les
              alertes de renouvellement, et sa licence sera retirée.
            </p>
            <p className="mt-2 font-semibold">À utiliser seulement si l’adhérent ne renouvelle pas.</p>
          </>
        }
        confirmLabel="Désinscrire"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </SectionCard>
  );
}
