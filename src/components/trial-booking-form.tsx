"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { formatTrialSlotDate, type TrialSlotListItem } from "@/lib/trial-slots";

export type TrialSlotOption = TrialSlotListItem;

type TrialBookingFormProps = {
  disciplineId: string;
  disciplineName: string;
  disciplineSlug: string;
  slots: TrialSlotOption[];
};

export default function TrialBookingForm({
  disciplineId,
  disciplineName,
  disciplineSlug,
  slots,
}: TrialBookingFormProps) {
  const router = useRouter();
  const [trialSlotId, setTrialSlotId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [motivation, setMotivation] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trialSlotId) {
      setMessage("Choisissez un créneau d'essai pour continuer.");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    setMessage("");
    const response = await fetch("/api/public-preinscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disciplineId,
        trialSlotId,
        firstName,
        lastName,
        phone,
        address,
        postalCode,
        city,
        email,
        password,
        motivation,
        documents: [],
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Demande enregistrée." : "Erreur."));
    setIsLoading(false);
    if (response.ok) {
      router.push(`/disciplines/${disciplineSlug}?essai=reserve`);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <p className="mb-4">
        <Link href={`/disciplines/${disciplineSlug}`} className="text-sm font-semibold text-cyan-700 hover:underline">
          ← Retour à {disciplineName}
        </Link>
      </p>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Réserver un essai — {disciplineName}</h1>
        <p className="mt-2 text-slate-700">
          Choisissez un créneau proposé par le bureau, puis complétez vos informations. Un compte sera créé pour
          suivre votre inscription.
        </p>

        {slots.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-medium">Aucun créneau d&apos;essai disponible pour le moment.</p>
            <p className="mt-2 text-sm">
              Revenez plus tard ou faites une{" "}
              <Link href="/preinscription" className="font-semibold underline">
                pré-inscription complète
              </Link>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <fieldset>
              <legend className="text-lg font-bold text-slate-900">Créneaux d&apos;essai disponibles</legend>
              <p className="mt-1 text-sm text-slate-600">Sélection obligatoire — un seul créneau par demande.</p>
              <div className="mt-4 space-y-3">
                {slots.map((slot) => {
                  const full = slot.registeredCount >= slot.capacity;
                  const placesLeft = Math.max(0, slot.capacity - slot.registeredCount);
                  return (
                    <label
                      key={slot.id}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                        full
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                          : trialSlotId === slot.id
                            ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-300"
                            : "border-slate-200 hover:border-cyan-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="trialSlot"
                        value={slot.id}
                        checked={trialSlotId === slot.id}
                        disabled={full}
                        onChange={() => setTrialSlotId(slot.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{slot.title}</p>
                        <p className="mt-1 text-sm text-slate-700">{formatTrialSlotDate(slot.startsAt)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {full
                            ? "Complet"
                            : `${placesLeft} place${placesLeft > 1 ? "s" : ""} restante${placesLeft > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-bold text-slate-900">Vos coordonnées</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Prénom
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Nom
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Téléphone
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Mot de passe
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    minLength={8}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Confirmer le mot de passe
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    minLength={8}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                  Adresse
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Code postal
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Ville
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                  Message (optionnel)
                  <textarea
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    rows={3}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || slots.every((s) => s.registeredCount >= s.capacity)}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              Réserver ce créneau d&apos;essai
            </button>
          </form>
        )}

        {message ? <p className="mt-4 text-sm font-medium text-slate-700">{message}</p> : null}

        <p className="mt-6 text-sm text-slate-600">
          Vous souhaitez vous inscrire sans essai ?{" "}
          <Link href="/preinscription" className="font-semibold text-cyan-700 underline">
            Pré-inscription complète
          </Link>
        </p>
      </section>
    </main>
  );
}
