"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/signature-pad";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  MEMBERSHIP_ACTIVITY_SLOTS,
  MEMBERSHIP_ADHESION_FEE,
  MEMBERSHIP_SEASON_LABEL,
  computeMembershipTotals,
  type MembershipBulletinFormPayload,
  type MembershipImageRights,
  type MembershipPaymentPlan,
} from "@/lib/membership-bulletin";

type MembershipBulletinFormProps = {
  disciplines: DisciplineOption[];
  initialDisciplineId?: string;
};

const STEPS = [
  "Coordonnées",
  "Activités & paiement",
  "Engagements",
  "Signature",
  "Aperçu PDF",
] as const;

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateFr(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export default function MembershipBulletinForm({
  disciplines,
  initialDisciplineId,
}: MembershipBulletinFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>(() => {
    if (!initialDisciplineId) return [];
    const discipline = disciplines.find((entry) => entry.id === initialDisciplineId);
    if (!discipline) return [];
    const haystack = `${discipline.name} ${discipline.slug}`.toLowerCase();
    const matched = MEMBERSHIP_ACTIVITY_SLOTS.find((slot) =>
      slot.matchKeywords.some((keyword) => haystack.includes(keyword)),
    );
    return matched ? [matched.id] : [];
  });
  const [paymentPlan, setPaymentPlan] = useState<MembershipPaymentPlan>("once");
  const [imageRights, setImageRights] = useState<MembershipImageRights>("authorize");
  const [acceptRules, setAcceptRules] = useState(false);
  const [acceptHealth, setAcceptHealth] = useState(false);
  const [acceptInsurance, setAcceptInsurance] = useState(false);
  const [acceptRefund, setAcceptRefund] = useState(false);
  const [signedPlace, setSignedPlace] = useState("Sainte-Croix");
  const [signedAt, setSignedAt] = useState(todayInputValue());
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const totals = useMemo(() => computeMembershipTotals(selectedSlots), [selectedSlots]);
  const commitmentsAccepted = acceptRules && acceptHealth && acceptInsurance && acceptRefund;

  function buildPayload(): MembershipBulletinFormPayload {
    return {
      firstName,
      lastName,
      phone,
      address,
      postalCode,
      city,
      email,
      password,
      birthDate,
      emergencyContactName,
      emergencyContactPhone,
      selectedSlots,
      paymentPlan,
      imageRights,
      commitmentsAccepted,
      signedPlace,
      signedAt: formatDateFr(signedAt),
      signatureDataUrl,
    };
  }

  function toggleSlot(slotId: string) {
    setSelectedSlots((previous) =>
      previous.includes(slotId)
        ? previous.filter((id) => id !== slotId)
        : [...previous, slotId],
    );
  }

  function validateCurrentStep(): string | null {
    if (step === 0) {
      if (
        !firstName.trim() ||
        !lastName.trim() ||
        !birthDate ||
        !phone.trim() ||
        !address.trim() ||
        !postalCode.trim() ||
        !city.trim() ||
        !email.trim() ||
        !emergencyContactName.trim() ||
        !emergencyContactPhone.trim()
      ) {
        return "Merci de remplir toutes les coordonnées.";
      }
      if (password.length < 8) {
        return "Le mot de passe doit contenir au moins 8 caractères.";
      }
      if (password !== passwordConfirm) {
        return "Les mots de passe ne correspondent pas.";
      }
    }
    if (step === 1) {
      if (selectedSlots.length === 0) return "Cochez au moins une activité.";
    }
    if (step === 2) {
      if (!commitmentsAccepted) {
        return "Vous devez accepter tous les engagements pour continuer.";
      }
    }
    if (step === 3) {
      if (!signatureDataUrl) return "Merci de signer dans l'encadré.";
      if (!signedAt) return "Indiquez la date de signature.";
    }
    return null;
  }

  async function goNext() {
    const error = validateCurrentStep();
    if (error) {
      setMessage(error);
      return;
    }
    setMessage("");

    if (step === 3) {
      setIsLoading(true);
      try {
        const response = await fetch("/api/public-membership-bulletin/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (!response.ok) {
          const payload = (await response.json()) as { message?: string };
          throw new Error(payload.message ?? "Impossible de générer l'aperçu PDF.");
        }
        const blob = await response.blob();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setStep(4);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Erreur d'aperçu.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setStep((previous) => Math.min(previous + 1, STEPS.length - 1));
  }

  function goBack() {
    setMessage("");
    if (step === 4 && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setStep((previous) => Math.max(previous - 1, 0));
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/public-preinscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(),
          bulletinMode: true,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Envoi impossible.");
      }
      router.push("/?preregistration=received");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur d'envoi.");
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Bulletin d&apos;adhésion</h1>
        <p className="mt-2 text-slate-700">
          Activ&apos; Sainte-Croix Sport et Culture — {MEMBERSHIP_SEASON_LABEL}. Remplissez le
          formulaire, signez, vérifiez le PDF, puis confirmez l&apos;envoi.
        </p>

        <ol className="mt-5 flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                index === step
                  ? "bg-cyan-700 text-white"
                  : index < step
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="mt-6 space-y-4">
          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Prénom *
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nom *
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Date de naissance *
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Téléphone *
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                Adresse *
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Code postal *
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Ville *
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                E-mail *
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Mot de passe (compte espace) *
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
                Confirmer le mot de passe *
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  minLength={8}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Contact urgence — nom *
                <input
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Contact urgence — téléphone *
                <input
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  required
                />
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Adhésion obligatoire : <strong>{MEMBERSHIP_ADHESION_FEE} €</strong> (ajoutée au tarif
                des activités).
              </p>
              <div className="space-y-2">
                {MEMBERSHIP_ACTIVITY_SLOTS.map((slot) => (
                  <label
                    key={slot.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSlots.includes(slot.id)}
                      onChange={() => toggleSlot(slot.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold">
                        {slot.day} {slot.time}
                      </span>
                      <span className="block text-slate-600">{slot.activity}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
                <p>1 activité : 180 € · 2 activités : 260 € · 3 activités : 320 €</p>
                <p className="mt-1 font-semibold">
                  Total à régler : {totals.grandTotal} €
                  {selectedSlots.length > 0
                    ? ` (adhésion ${MEMBERSHIP_ADHESION_FEE} € + activités ${totals.activitiesTotal} €)`
                    : ""}
                </p>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900">Modalité de paiement</legend>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="paymentPlan"
                    checked={paymentPlan === "once"}
                    onChange={() => setPaymentPlan("once")}
                    className="mt-1"
                  />
                  Paiement en 1 fois à l&apos;inscription (chèque à l&apos;ordre Activ Sainte-Croix Sport
                  et Culture, virement ou espèces)
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="paymentPlan"
                    checked={paymentPlan === "three_times"}
                    onChange={() => setPaymentPlan("three_times")}
                    className="mt-1"
                  />
                  Paiement en 3 fois (chèques encaissés le 10/09/2026, 10/01/2027 et 10/04/2027)
                </label>
              </fieldset>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4 text-sm text-slate-700">
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={acceptRules}
                  onChange={(e) => setAcceptRules(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong>Règlement intérieur :</strong> je m&apos;engage à respecter le règlement
                  intérieur de l&apos;association ainsi que les consignes de sécurité des locaux mis à
                  disposition par la mairie de Sainte-Croix.
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={acceptHealth}
                  onChange={(e) => setAcceptHealth(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong>Santé :</strong> je certifie être en condition physique suffisante pour
                  pratiquer les activités cochées, sous ma propre responsabilité, et signaler toute
                  situation particulière à l&apos;intervenant.
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={acceptInsurance}
                  onChange={(e) => setAcceptInsurance(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong>Assurance :</strong> j&apos;ai été informé de l&apos;intérêt à souscrire une
                  assurance individuelle accidents corporels. L&apos;association ne fournit pas cette
                  garantie.
                </span>
              </label>
              <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
                <legend className="px-1 text-sm font-semibold text-slate-900">Droit à l&apos;image</legend>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="imageRights"
                    checked={imageRights === "authorize"}
                    onChange={() => setImageRights("authorize")}
                    className="mt-1"
                  />
                  J&apos;autorise l&apos;association à utiliser mon image pour ses supports et Facebook.
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="imageRights"
                    checked={imageRights === "refuse"}
                    onChange={() => setImageRights("refuse")}
                    className="mt-1"
                  />
                  Je n&apos;autorise pas l&apos;utilisation de mon image.
                </label>
              </fieldset>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={acceptRefund}
                  onChange={(e) => setAcceptRefund(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong>Remboursement :</strong> je reconnais que les cotisations sont non
                  remboursables sauf cas de force majeure justifié, étudié au cas par cas par le
                  bureau.
                </span>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Je certifie avoir pris connaissance de l&apos;ensemble des informations et déclarations
                du bulletin.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Fait à
                  <input
                    value={signedPlace}
                    onChange={(e) => setSignedPlace(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Le
                  <input
                    type="date"
                    value={signedAt}
                    onChange={(e) => setSignedAt(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Signature de l&apos;adhérent(e) (souris ou doigt)
                </p>
                <SignaturePad onChange={setSignatureDataUrl} disabled={isLoading} />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Vérifiez le bulletin PDF ci-dessous. S&apos;il est correct, confirmez l&apos;envoi : le
                bureau recevra le dossier signé et vous recevrez une copie par e-mail.
              </p>
              {previewUrl ? (
                <iframe
                  title="Aperçu bulletin d'adhésion"
                  src={previewUrl}
                  className="h-[70vh] w-full rounded-xl border border-slate-200"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={isLoading}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              Retour
            </button>
          ) : null}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => void goNext()}
              disabled={isLoading}
              className="rounded-xl bg-cyan-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isLoading && step === 3 ? "Génération du PDF…" : "Continuer"}
            </button>
          ) : (
            <button
              type="button"
              onClick={(event) => void handleConfirm(event)}
              disabled={isLoading}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isLoading ? "Envoi en cours…" : "Confirmer et envoyer mon bulletin"}
            </button>
          )}
        </div>

        {message ? <p className="mt-3 text-sm font-medium text-rose-700">{message}</p> : null}
      </section>
    </main>
  );
}
