"use client";

import { FormEvent, useState } from "react";
import type { DisciplineOption } from "@/lib/discipline-options";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/dossier-workflow";
import { reloadAfterDossierChange } from "@/lib/bureau-navigation";

type ManualMemberPanelProps = {
  disciplines: DisciplineOption[];
};

const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900";

export default function ManualMemberPanel({ disciplines }: ManualMemberPanelProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [disciplineIds, setDisciplineIds] = useState<string[]>([]);
  const [signedBulletinReceived, setSignedBulletinReceived] = useState(false);
  const [signedBulletinReceivedAt, setSignedBulletinReceivedAt] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  function toggleDiscipline(disciplineId: string) {
    setDisciplineIds((previous) =>
      previous.includes(disciplineId)
        ? previous.filter((id) => id !== disciplineId)
        : [...previous, disciplineId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (disciplineIds.length === 0) {
      setMessage("Sélectionnez au moins une activité.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/club/manual-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          address,
          postalCode,
          city,
          disciplineIds,
          signedBulletinReceived,
          signedBulletinReceivedAt: signedBulletinReceivedAt || undefined,
          amountPaid: amountPaid.trim() ? amountPaid : null,
          paymentStatus,
          paymentMethod: paymentMethod || undefined,
          notes,
        }),
      });
      const text = await response.text();
      let payload: { message?: string } = {};
      if (text.trim()) {
        try {
          payload = JSON.parse(text) as { message?: string };
        } catch {
          payload = {};
        }
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "Ajout impossible.");
      }
      setMessage(payload.message ?? "Adhérent papier ajouté.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setPostalCode("");
      setCity("");
      setDisciplineIds([]);
      setSignedBulletinReceived(false);
      setSignedBulletinReceivedAt("");
      setAmountPaid("");
      setPaymentStatus("unpaid");
      setPaymentMethod("");
      setNotes("");
      window.setTimeout(() => reloadAfterDossierChange(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="bento-card min-w-0 p-5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-lg font-bold text-slate-900">Ajouter un adhérent papier</span>
          <span className="mt-1 block text-sm text-slate-600">
            Pour les inscriptions reçues au bureau, sans compte en ligne.
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-amber-800">
          {isOpen ? "Replier" : "Ouvrir"}
        </span>
      </button>

      {isOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Prénom *
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nom *
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="Utile pour les annonces et attestations"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Téléphone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Adresse
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Code postal
              <input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Ville
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <fieldset className="rounded-xl border border-slate-200 bg-white/70 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">Activités *</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {disciplines.map((discipline) => (
                <label
                  key={discipline.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={disciplineIds.includes(discipline.id)}
                    onChange={() => toggleDiscipline(discipline.id)}
                  />
                  {discipline.name}
                </label>
              ))}
            </div>
            {disciplines.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Aucune activité active sur le site.</p>
            ) : null}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-3 text-sm font-medium text-slate-800 sm:col-span-2">
              <input
                type="checkbox"
                checked={signedBulletinReceived}
                onChange={(event) => setSignedBulletinReceived(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Bulletin papier signé réceptionné
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  Le dossier sera marqué comme adhérent papier validé.
                </span>
              </span>
            </label>
            {signedBulletinReceived ? (
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Date de réception du bulletin
                <input
                  type="date"
                  value={signedBulletinReceivedAt}
                  onChange={(event) => setSignedBulletinReceivedAt(event.target.value)}
                  className={inputClass}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Paiement
              <select
                value={paymentStatus}
                onChange={(event) => setPaymentStatus(event.target.value as "unpaid" | "paid")}
                className={inputClass}
              >
                <option value="unpaid">Pas encore encaissé</option>
                <option value="paid">Encaissé</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Montant encaissé (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                className={inputClass}
                placeholder="Ex. 190"
              />
            </label>
            {paymentStatus === "paid" ? (
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Mode de paiement *
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Choisir…</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Notes internes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass}
                rows={2}
                placeholder="Ex. chèque n°123, certificat à fournir…"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving || disciplineIds.length === 0}
            className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {isSaving ? "Ajout en cours…" : "Ajouter l'adhérent papier"}
          </button>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
