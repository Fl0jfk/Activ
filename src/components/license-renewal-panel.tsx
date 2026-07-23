"use client";

import { useMemo, useState } from "react";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  addOneYearLicenseDate,
  formatLicenseEndDateFr,
  isLicenseExpired,
  listApplicationsNeedingLicenseRenewal,
} from "@/lib/license-renewal";

type LicenseRenewalPanelProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
};

export default function LicenseRenewalPanel({
  disciplines,
  applications,
}: LicenseRenewalPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const alerts = useMemo(
    () => listApplicationsNeedingLicenseRenewal(applications),
    [applications],
  );

  async function patchApplication(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/club/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Mise à jour impossible.");
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
      setBusyId(null);
    }
  }

  if (alerts.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Renouvellements</h2>
        <p className="mt-1 text-sm text-slate-600">
          Aucune licence à renouveler dans les 30 prochains jours.
        </p>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-rose-950">Renouvellements</h2>
      <p className="mt-1 text-sm text-rose-900/80">
        Licences expirées ou qui se terminent dans moins de 30 jours.
      </p>
      <ul className="mt-4 space-y-3">
        {alerts.map((app) => {
          const disciplineName =
            disciplines.find((d) => d.id === app.disciplineId)?.name ?? "Discipline";
          const expired = isLicenseExpired(app.licenseEndDate);
          const busy = busyId === app.id;
          return (
            <li
              key={app.id}
              className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{app.fullName || app.email}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {disciplineName}
                    {app.email ? ` · ${app.email}` : ""}
                  </p>
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      expired ? "text-rose-700" : "text-amber-800"
                    }`}
                  >
                    {expired ? "Licence terminée le " : "Licence jusqu’au "}
                    {app.licenseEndDate ? formatLicenseEndDateFr(app.licenseEndDate) : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchApplication(app.id, {
                        status: "approved",
                        paymentStatus: "paid",
                        licenseEndDate: addOneYearLicenseDate(),
                      })
                    }
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Renouvelé (+1 an)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Marquer ${app.fullName || app.email} comme désinscrit ?`,
                      );
                      if (!confirmed) return;
                      void patchApplication(app.id, {
                        status: "cancelled",
                        licenseEndDate: null,
                      });
                    }}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800 disabled:opacity-50"
                  >
                    Désinscrit
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
