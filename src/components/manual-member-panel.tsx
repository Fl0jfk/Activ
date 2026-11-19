"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { StatusMessage, type Feedback } from "@/components/bureau-ui";
import type { DisciplineOption } from "@/lib/discipline-options";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/dossier-workflow";
import { fetchJson, jsonInit } from "@/lib/fetch-json";

type ManualMemberPanelProps = {
  disciplines: DisciplineOption[];
};

const ANCHOR = "adherent-papier";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Ouverture demandée par l’adresse (`/espace/bureau/dossiers#adherent-papier`). */
function useHashRequestsOpen(): boolean {
  return useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash === `#${ANCHOR}`,
    () => false,
  );
}

export default function ManualMemberPanel({ disciplines }: ManualMemberPanelProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const hashRequestsOpen = useHashRequestsOpen();
  const [manualOpen, setManualOpen] = useState(false);
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
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOpen = manualOpen || hashRequestsOpen;

  function toggleOpen() {
    if (isOpen) {
      setManualOpen(false);
      if (window.location.hash === `#${ANCHOR}`) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    } else {
      setManualOpen(true);
    }
  }

  function toggleDiscipline(disciplineId: string) {
    setDisciplineIds((previous) =>
      previous.includes(disciplineId)
        ? previous.filter((id) => id !== disciplineId)
        : [...previous, disciplineId],
    );
  }

  function resetForm() {
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (disciplineIds.length === 0) {
      setFeedback({ tone: "error", text: "Cochez au moins une activité pour cet adhérent." });
      return;
    }
    if (paymentStatus === "paid" && !paymentMethod) {
      setFeedback({ tone: "error", text: "Choisissez le mode de paiement encaissé." });
      return;
    }
    setIsSaving(true);
    try {
      const result = await fetchJson(
        "/api/club/manual-members",
        jsonInit("POST", {
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
      );
      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.message || "L’adhérent n’a pas pu être ajouté. Vérifiez les informations puis réessayez.",
        });
        return;
      }
      const name = `${firstName} ${lastName}`.trim();
      setFeedback({
        tone: "success",
        text: `${name} a été ajouté(e). Son dossier apparaît dans la liste ci-dessous${
          paymentStatus === "paid" ? " (onglet « Finalisés »)" : " (onglet « En cours »)"
        }.`,
      });
      resetForm();
      startRefresh(() => router.refresh());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id={ANCHOR} className="anchor-section panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Adhérent papier</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Pour une inscription reçue au bureau sur papier, sans compte en ligne.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          className={`btn btn-sm ${isOpen ? "btn-ghost" : "btn-outline"}`}
        >
          {isOpen ? "Fermer" : "+ Adhérent papier"}
        </button>
      </div>

      {!isOpen && feedback ? <StatusMessage feedback={feedback} className="mt-4" /> : null}

      {isOpen ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="field-label">
              Prénom *
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="field"
                autoComplete="off"
                required
              />
            </label>
            <label className="field-label">
              Nom *
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="field"
                autoComplete="off"
                required
              />
            </label>
            <label className="field-label">
              Téléphone
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="field"
                autoComplete="off"
              />
            </label>
            <label className="field-label">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
                placeholder="Pour les annonces et l’attestation"
                autoComplete="off"
              />
            </label>
            <label className="field-label md:col-span-2 lg:col-span-2">
              Adresse
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="field"
                autoComplete="off"
              />
            </label>
            <label className="field-label">
              Code postal
              <input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="field"
                autoComplete="off"
              />
            </label>
            <label className="field-label">
              Ville
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="field"
                autoComplete="off"
              />
            </label>
          </div>

          <fieldset className="rounded-2xl border border-brand-line p-4">
            <legend className="px-1 text-[15px] font-bold text-slate-900">Activités *</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {disciplines.map((discipline) => (
                <label
                  key={discipline.id}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
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

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-brand-line bg-brand-cream/60 px-4 py-3 text-sm font-semibold text-slate-800 md:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={signedBulletinReceived}
                onChange={(event) => setSignedBulletinReceived(event.target.checked)}
                className="mt-0.5 h-5 w-5"
              />
              <span>
                Bulletin papier signé reçu
                <span className="mt-0.5 block text-sm font-normal text-slate-600">
                  Le dossier sera considéré comme validé et passera directement à l’étape « Paiement ».
                </span>
              </span>
            </label>
            {signedBulletinReceived ? (
              <label className="field-label">
                Date de réception du bulletin
                <input
                  type="date"
                  value={signedBulletinReceivedAt}
                  onChange={(event) => setSignedBulletinReceivedAt(event.target.value)}
                  className="field"
                />
              </label>
            ) : null}
            <label className="field-label">
              Paiement
              <select
                value={paymentStatus}
                onChange={(event) => setPaymentStatus(event.target.value as "unpaid" | "paid")}
                className="field"
              >
                <option value="unpaid">Pas encore encaissé</option>
                <option value="paid">Encaissé</option>
              </select>
            </label>
            <label className="field-label">
              Montant encaissé (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                className="field"
                placeholder="Ex. 190"
              />
            </label>
            {paymentStatus === "paid" ? (
              <label className="field-label">
                Mode de paiement *
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="field"
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
            <label className="field-label md:col-span-2 lg:col-span-3">
              Notes internes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="field"
                rows={2}
                placeholder="Ex. chèque n° 123, certificat à fournir…"
              />
            </label>
          </div>

          <div className="space-y-3">
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              {isSaving ? "Ajout en cours…" : "Ajouter l’adhérent papier"}
            </button>
            <StatusMessage feedback={feedback} />
          </div>
        </form>
      ) : null}
    </section>
  );
}
