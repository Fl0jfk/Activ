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

type MemberContactSectionProps = {
  application: RegistrationApplication;
  pendingRequest: MemberContactChangeRequest | null;
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MemberContactSection({
  application,
  pendingRequest,
}: MemberContactSectionProps) {
  const current = contactValuesFromApplication(application);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [values, setValues] = useState<MemberContactValues>(current);

  function update(key: keyof MemberContactValues, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function startEdit() {
    setValues(pendingRequest ? pendingRequestValues(pendingRequest) : current);
    setError("");
    setStatusMessage("");
    setEditing(true);
  }

  async function submit() {
    if (!values.firstName.trim() || !values.lastName.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    if (!values.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError("Une adresse e-mail valide est obligatoire.");
      return;
    }

    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/me/contact-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id, ...values }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Envoi de la demande impossible.");
        return;
      }
      setEditing(false);
      setStatusMessage(
        payload.message ??
          "Votre demande est envoyée. Le bureau doit la valider avant son application.",
      );
      window.location.reload();
    } catch {
      setError("Envoi de la demande impossible. Réessayez dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 disabled:bg-slate-100";

  return (
    <section id="mes-coordonnees" className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Mes coordonnées</h2>
          <p className="mt-1 text-sm text-slate-600">
            Signalez une correction au bureau. Les nouvelles coordonnées ne sont appliquées
            qu&apos;après sa validation, y compris pour l&apos;adresse de connexion.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white"
          >
            {pendingRequest ? "Modifier ma demande" : "Demander une modification"}
          </button>
        ) : null}
      </div>

      {pendingRequest ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            Demande en attente de validation
            {pendingRequest.createdAt ? ` — envoyée le ${formatDate(pendingRequest.createdAt)}` : ""}
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            Le bureau doit la valider avant que les changements soient appliqués à votre dossier
            et à votre compte de connexion.
          </p>
          <ul className="mt-2 grid gap-1 text-sm text-amber-900/80 sm:grid-cols-2">
            {(Object.keys(FIELD_LABELS) as (keyof MemberContactValues)[])
              .filter(
                (key) =>
                  pendingRequest[key].trim().toLowerCase() !==
                  current[key].trim().toLowerCase(),
              )
              .map((key) => (
                <li key={key} className="min-w-0 break-words [overflow-wrap:anywhere]">
                  <span className="font-medium">{FIELD_LABELS[key]} :</span>{" "}
                  {pendingRequest[key] || "—"}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {editing ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Prénom
              <input
                value={values.firstName}
                onChange={(event) => update("firstName", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="given-name"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Nom
              <input
                value={values.lastName}
                onChange={(event) => update("lastName", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="family-name"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              E-mail
              <input
                type="email"
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="email"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Téléphone
              <input
                type="tel"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="tel"
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Adresse
              <input
                value={values.address}
                onChange={(event) => update("address", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="street-address"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Code postal
              <input
                value={values.postalCode}
                onChange={(event) => update("postalCode", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="postal-code"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Ville
              <input
                value={values.city}
                onChange={(event) => update("city", event.target.value)}
                disabled={saving}
                className={fieldClass}
                autoComplete="address-level2"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            L&apos;e-mail est aussi l&apos;adresse de connexion à votre espace : elle sera mise à
            jour par le bureau en même temps que la fiche.
          </p>
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Envoi…" : "Envoyer au bureau"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Nom</dt>
            <dd className="font-medium text-slate-900">
              {[current.firstName, current.lastName].filter(Boolean).join(" ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">E-mail</dt>
            <dd className="text-break font-medium text-slate-900">{current.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Téléphone</dt>
            <dd className="font-medium text-slate-900">{current.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Adresse</dt>
            <dd className="font-medium text-slate-900">{current.address || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Code postal</dt>
            <dd className="font-medium text-slate-900">{current.postalCode || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ville</dt>
            <dd className="font-medium text-slate-900">{current.city || "—"}</dd>
          </div>
        </dl>
      )}

      {statusMessage ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}

function pendingRequestValues(
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
