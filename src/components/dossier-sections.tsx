"use client";

import { useState, type ReactNode } from "react";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";
import { formatDateFr, formatEuro } from "@/lib/dossier-format";
import { getApplicationDisciplineIds, getApplicationDisciplineNames } from "@/lib/dossier-workflow";
import { splitFullName } from "@/lib/member-contact";

export type DossierUpdate = (
  payload: ApplicationUpdatePayload,
  successMessage?: string,
) => Promise<boolean>;

/** Section repliable d’un dossier (natif `<details>` : clavier et lecteurs d’écran gérés par le navigateur). */
export function DossierSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen || undefined} className="group rounded-2xl border border-brand-line bg-white">
      <summary className="flex min-h-12 list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-slate-900">{title}</span>
          {summary ? <span className="block text-sm text-slate-600">{summary}</span> : null}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-lg font-bold text-brand-blue transition group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div className="border-t border-brand-line p-4">{children}</div>
    </details>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-break text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

export function contactSummary(application: RegistrationApplication): string {
  return [application.email, application.phone].filter((value) => value?.trim()).join(" · ") || "Aucune coordonnée";
}

export function ContactSection({
  application,
  disabled,
  onUpdate,
}: {
  application: RegistrationApplication;
  disabled: boolean;
  onUpdate: DossierUpdate;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  function startEdit() {
    const name = splitFullName(application.fullName, application.firstName ?? "", application.lastName ?? "");
    setFirstName(name.firstName);
    setLastName(name.lastName);
    setEmail(application.email ?? "");
    setPhone(application.phone ?? "");
    setAddress(application.address ?? "");
    setPostalCode(application.postalCode ?? "");
    setCity(application.city ?? "");
    setError("");
    setEditing(true);
  }

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    const nextEmail = email.trim().toLowerCase();
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("Cette adresse e-mail n’est pas valide. Exemple : prenom.nom@exemple.fr");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await onUpdate(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: nextEmail,
          phone: phone.trim(),
          address: address.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
        },
        "Coordonnées enregistrées.",
      );
      if (saved) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    const locked = saving || disabled;
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Prénom
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="given-name"
            />
          </label>
          <label className="field-label">
            Nom
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="family-name"
            />
          </label>
          <label className="field-label">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="email"
              placeholder="adresse@exemple.fr"
            />
          </label>
          <label className="field-label">
            Téléphone
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="tel"
            />
          </label>
          <label className="field-label sm:col-span-2">
            Adresse
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="street-address"
            />
          </label>
          <label className="field-label">
            Code postal
            <input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="postal-code"
            />
          </label>
          <label className="field-label">
            Ville
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={locked}
              className="field"
              autoComplete="address-level2"
            />
          </label>
        </div>
        <p className="text-sm text-slate-600">
          L’adresse e-mail sert aux envois du bureau et à la connexion de l’adhérent à son espace. L’ancienne
          adresse ne permettra plus de se connecter.
        </p>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void save()} disabled={locked} className="btn btn-primary btn-sm">
            {saving ? "Enregistrement…" : "Enregistrer les coordonnées"}
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn btn-ghost btn-sm">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Nom">{application.fullName}</Detail>
        <Detail label="E-mail">
          {application.email || "—"}
          {application.emailVerifiedAt ? (
            <span className="block text-sm font-normal text-brand-green-dark">
              ✓ Adresse confirmée le {formatDateFr(application.emailVerifiedAt)}
            </span>
          ) : application.origin === "online" ? (
            <span className="block text-sm font-normal text-amber-800">Adresse non confirmée par code</span>
          ) : null}
        </Detail>
        <Detail label="Téléphone">{application.phone || "—"}</Detail>
        <Detail label="Adresse">{application.address?.trim() || "—"}</Detail>
        <Detail label="Code postal">{application.postalCode?.trim() || "—"}</Detail>
        <Detail label="Ville">{application.city?.trim() || "—"}</Detail>
      </dl>
      {application.motivation ? (
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-600">Motivation : </span>
          {application.motivation}
        </p>
      ) : null}
      <button type="button" onClick={startEdit} disabled={disabled} className="btn btn-ghost btn-sm">
        Modifier les coordonnées
      </button>
    </div>
  );
}

export function ActivitiesSection({
  application,
  disciplines,
  disabled,
  onUpdate,
}: {
  application: RegistrationApplication;
  disciplines: DisciplineOption[];
  disabled: boolean;
  onUpdate: DossierUpdate;
}) {
  const currentIds = getApplicationDisciplineIds(application);
  const currentNames = getApplicationDisciplineNames(application, disciplines);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
    );
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await onUpdate({ disciplineIds: selected }, "Activités enregistrées.");
      if (saved) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-800">
          <span className="font-semibold">Activités choisies : </span>
          {currentNames.join(", ") || "Aucune"}
        </p>
        <button
          type="button"
          disabled={disabled || disciplines.length === 0}
          onClick={() => {
            setSelected(currentIds);
            setEditing(true);
          }}
          className="btn btn-ghost btn-sm"
        >
          Modifier les activités
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">Cochez toutes les activités de cet adhérent :</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {disciplines.map((discipline) => (
          <label
            key={discipline.id}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={selected.includes(discipline.id)}
              onChange={() => toggle(discipline.id)}
              disabled={saving}
            />
            {discipline.name}
          </label>
        ))}
      </div>
      {selected.length === 0 ? (
        <p className="text-sm font-semibold text-amber-800">Choisissez au moins une activité.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || saving || selected.length === 0}
          onClick={() => void save()}
          className="btn btn-primary btn-sm"
        >
          {saving ? "Enregistrement…" : "Enregistrer les activités"}
        </button>
        <button type="button" disabled={saving} onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
          Annuler
        </button>
      </div>
    </div>
  );
}

export function bulletinSummary(application: RegistrationApplication): string {
  if (application.membershipBulletin) {
    return `Total : ${application.membershipBulletin.grandTotal} €`;
  }
  if (application.origin === "paper") {
    return application.signedBulletinReceivedAt
      ? `Bulletin papier reçu le ${formatDateFr(application.signedBulletinReceivedAt)}`
      : "Bulletin papier non reçu";
  }
  return "Pas de bulletin en ligne";
}

export function BulletinSection({
  application,
  busy,
  onRequestRevalidation,
}: {
  application: RegistrationApplication;
  busy: boolean;
  onRequestRevalidation: () => void;
}) {
  const bulletin = application.membershipBulletin;
  const isPaper = application.origin === "paper";
  return (
    <div className="space-y-3">
      {bulletin ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Date de naissance">{bulletin.birthDate}</Detail>
          <Detail label="Contact en cas d’urgence">
            {bulletin.emergencyContactName} — {bulletin.emergencyContactPhone}
          </Detail>
          <Detail label="Total du bulletin">{bulletin.grandTotal} €</Detail>
          <Detail label="Droit à l’image">{bulletin.imageRights === "authorize" ? "Autorisé" : "Refusé"}</Detail>
        </dl>
      ) : null}
      {isPaper ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Bulletin papier signé">
            {application.signedBulletinReceivedAt
              ? `Reçu le ${formatDateFr(application.signedBulletinReceivedAt, "long")}`
              : "Non reçu"}
          </Detail>
          <Detail label="Montant saisi au bureau">
            {typeof application.amountPaid === "number" ? formatEuro(application.amountPaid) : "—"}
          </Detail>
        </dl>
      ) : null}
      {!bulletin && !isPaper ? (
        <p className="text-sm text-slate-600">Cet adhérent n’a pas encore rempli son bulletin d’adhésion en ligne.</p>
      ) : null}
      {!isPaper ? (
        <div className="rounded-2xl bg-brand-cream p-3">
          <p className="text-sm text-slate-700">
            Pour que l’adhérent relise et signe de nouveau son bulletin, renvoyez-lui un lien sécurisé par e-mail.
          </p>
          <button
            type="button"
            disabled={busy || !application.email?.trim()}
            onClick={onRequestRevalidation}
            className="btn btn-outline btn-sm mt-2"
          >
            Renvoyer le bulletin d’adhésion
          </button>
          {!application.email?.trim() ? (
            <p className="mt-2 text-sm text-slate-600">Aucune adresse e-mail sur ce dossier.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Message affiché à l’adhérent dans son espace (les notes internes ne lui sont jamais montrées). */
export function MemberMessageSection({
  application,
  disabled,
  onUpdate,
}: {
  application: RegistrationApplication;
  disabled: boolean;
  onUpdate: DossierUpdate;
}) {
  const saved = application.memberMessage ?? "";
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);

  async function save(value: string) {
    setSaving(true);
    try {
      const done = await onUpdate(
        { memberMessage: value.trim() },
        value.trim() ? "Message enregistré : l’adhérent le voit dans son espace." : "Message retiré.",
      );
      if (done) setDraft(value.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="field-label">
        Message visible par l’adhérent
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled || saving}
          maxLength={1000}
          rows={3}
          className="field"
          placeholder="Ex. Merci d’apporter votre certificat médical lors de votre premier cours."
        />
      </label>
      <p className="text-sm text-slate-600">
        Ce texte est affiché à l’adhérent dans son espace. Il ne doit contenir aucune information interne.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || saving || draft.trim() === saved.trim()}
          onClick={() => void save(draft)}
          className="btn btn-primary btn-sm"
        >
          {saving ? "Enregistrement…" : "Enregistrer le message"}
        </button>
        {saved.trim() ? (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void save("")}
            className="btn btn-ghost btn-sm"
          >
            Retirer le message
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TrialSection({
  trialAttended,
  disabled,
  onToggle,
}: {
  trialAttended: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-slate-800">
        {trialAttended ? "L’adhérent a fait son essai." : "L’essai n’a pas encore eu lieu."}
      </p>
      <button type="button" disabled={disabled} onClick={onToggle} className="btn btn-ghost btn-sm">
        Marquer l’essai comme {trialAttended ? "non réalisé" : "réalisé"}
      </button>
    </div>
  );
}
