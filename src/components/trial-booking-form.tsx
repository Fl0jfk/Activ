"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import EmailVerificationField, { type VerifiedEmail } from "@/components/email-verification-field";
import { PasswordFields, validatePasswordPair } from "@/components/forms/account-fields";
import { ApplicantAddressFields, ApplicantIdentityFields, type ApplicantFieldValues } from "@/components/forms/applicant-fields";
import ChoiceCard from "@/components/forms/choice-card";
import ErrorSummary, { focusFirstError, type FieldErrors } from "@/components/forms/error-summary";
import { TextAreaField } from "@/components/forms/field-controls";
import {
  MESSAGES,
  isValidEmail,
  isValidPhone,
  isValidPostalCode,
  normalizeEmail,
} from "@/components/forms/validators";
import ActionBar from "@/components/inscription/action-bar";
import { ExistingAccountNotice } from "@/components/inscription/steps/account-step";
import { AlreadyReceivedScreen } from "@/components/inscription/result-screens";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import { formatTrialSlotDate, type TrialSlotListItem } from "@/lib/trial-slots";

export type TrialSlotOption = TrialSlotListItem;

type TrialBookingFormProps = {
  disciplineId: string;
  disciplineName: string;
  disciplineSlug: string;
  slots: TrialSlotOption[];
};

type SubmitResponse = {
  ok?: boolean;
  message?: string;
  alreadyReceived?: boolean;
  code?: string;
  fieldErrors?: Record<string, string>;
};

const FIELD_ORDER = [
  "trialSlotId",
  "firstName",
  "lastName",
  "phone",
  "address",
  "postalCode",
  "city",
  "email",
  "emailCode",
  "password",
  "passwordConfirm",
  "motivation",
] as const;

const FIELD_LABELS: Record<string, string> = {
  trialSlotId: "Créneau d’essai",
  firstName: "Prénom",
  lastName: "Nom",
  phone: "Téléphone",
  address: "Adresse",
  postalCode: "Code postal",
  city: "Commune",
  email: "Adresse e-mail",
  password: "Mot de passe",
  passwordConfirm: "Confirmation du mot de passe",
};

const EMPTY_APPLICANT: ApplicantFieldValues = {
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  postalCode: "",
  city: "",
};

export default function TrialBookingForm({
  disciplineId,
  disciplineName,
  disciplineSlug,
  slots,
}: TrialBookingFormProps) {
  const router = useRouter();
  const [trialSlotId, setTrialSlotId] = useState("");
  const [applicant, setApplicant] = useState<ApplicantFieldValues>(EMPTY_APPLICANT);
  const [email, setEmail] = useState("");
  const [verification, setVerification] = useState<VerifiedEmail | null>(null);
  const [serverAccountEmail, setServerAccountEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [motivation, setMotivation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReceived, setAlreadyReceived] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const focusRequest = useRef<"error" | "summary" | `field:${string}` | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const normalizedEmail = normalizeEmail(email);
  const verified =
    verification && verification.email === normalizedEmail
      ? { verificationId: verification.verificationId, accountExists: verification.accountExists }
      : null;
  const accountExists = Boolean(verified?.accountExists) || serverAccountEmail === normalizedEmail;
  const allFull = slots.every((slot) => slot.registeredCount >= slot.capacity);

  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    if (request === "summary") {
      summaryRef.current?.focus();
    } else if (request === "error") {
      if (!focusFirstError(errors, FIELD_ORDER)) summaryRef.current?.focus();
    } else {
      document.getElementById(`field-${request.slice("field:".length)}`)?.focus();
    }
  });

  function clearError(...keys: string[]) {
    setErrors((previous) => {
      if (!keys.some((key) => previous[key])) return previous;
      const next = { ...previous };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!trialSlotId) found.trialSlotId = "Choisissez un créneau d’essai.";
    if (!applicant.firstName.trim()) found.firstName = MESSAGES.firstName;
    if (!applicant.lastName.trim()) found.lastName = MESSAGES.lastName;
    if (!applicant.phone.trim()) found.phone = MESSAGES.phoneMissing;
    else if (!isValidPhone(applicant.phone)) found.phone = MESSAGES.phone;
    if (!applicant.address.trim()) found.address = MESSAGES.address;
    if (!isValidPostalCode(applicant.postalCode)) found.postalCode = MESSAGES.postalCode;
    if (!applicant.city.trim()) found.city = MESSAGES.city;
    if (!email.trim()) found.email = MESSAGES.emailMissing;
    else if (!isValidEmail(email)) found.email = MESSAGES.email;
    else if (!verified) found.email = "Confirmez votre adresse avec le code reçu par e-mail avant de continuer.";
    else if (accountExists) {
      found.email = "Un compte existe déjà avec cette adresse : connectez-vous ou utilisez une autre adresse.";
    }
    if (verified && !accountExists) {
      const passwordErrors = validatePasswordPair(password, passwordConfirm);
      if (passwordErrors.password) found.password = passwordErrors.password;
      if (passwordErrors.passwordConfirm) found.passwordConfirm = passwordErrors.passwordConfirm;
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setTopError("");
      focusRequest.current = "error";
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});
    setTopError("");

    const result = await fetchJson<SubmitResponse>(
      "/api/public-preinscriptions",
      jsonInit("POST", {
        disciplineId,
        trialSlotId,
        firstName: applicant.firstName.trim(),
        lastName: applicant.lastName.trim(),
        phone: applicant.phone.trim(),
        address: applicant.address.trim(),
        postalCode: applicant.postalCode.trim(),
        city: applicant.city.trim(),
        email: normalizedEmail,
        password,
        emailVerificationId: verified?.verificationId,
        motivation: motivation.trim(),
        documents: [],
      }),
    );

    if (result.ok) {
      if (result.data?.alreadyReceived) {
        submittingRef.current = false;
        setSubmitting(false);
        setAlreadyReceived(result.message);
        return;
      }
      router.push(`/disciplines/${disciplineSlug}?essai=reserve`);
      return;
    }

    submittingRef.current = false;
    setSubmitting(false);
    const code = result.data?.code;
    const fieldErrors = result.data?.fieldErrors ?? {};
    const next: FieldErrors = {};
    const general: string[] = [];
    for (const [key, message] of Object.entries(fieldErrors)) {
      if (FIELD_ORDER.includes(key as (typeof FIELD_ORDER)[number])) next[key] = message;
      else general.push(message);
    }
    if (code === "existing_account") {
      setServerAccountEmail(normalizedEmail);
      next.email = result.message || "Un compte existe déjà avec cette adresse e-mail.";
    } else if (code === "email_not_verified") {
      setVerification(null);
      next.email = "Votre adresse e-mail n’est plus confirmée. Demandez un nouveau code pour continuer.";
    } else if (code === "password_invalid" && !next.password) {
      next.password = result.message || "Ce mot de passe n’est pas accepté. Choisissez-en un autre.";
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      setTopError(general.join(" "));
      focusRequest.current = "error";
    } else {
      setTopError(result.message || "L’envoi a échoué. Vérifiez votre connexion puis réessayez.");
      focusRequest.current = "summary";
    }
  }

  if (alreadyReceived !== null) return <AlreadyReceivedScreen message={alreadyReceived} />;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-8 sm:pt-10">
      <p className="mb-4">
        <Link
          href={`/disciplines/${disciplineSlug}`}
          className="inline-flex min-h-11 items-center text-[15px] font-bold text-brand-blue hover:underline"
        >
          ← Retour à {disciplineName}
        </Link>
      </p>

      <header className="mb-6">
        <span className="eyebrow">Séance d’essai</span>
        <h1 className="section-title mt-2">Réserver un essai — {disciplineName}</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-700">
          Choisissez un créneau proposé par le bureau, puis complétez vos informations. Un compte sera créé pour suivre
          votre inscription. Tous les champs sont obligatoires, sauf le message.
        </p>
      </header>

      {slots.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="font-bold">Aucun créneau d’essai disponible pour le moment.</p>
          <p className="mt-2 text-[15px]">
            Revenez plus tard ou faites une{" "}
            <Link href="/preinscription" className="font-bold underline">
              pré-inscription complète
            </Link>
            .
          </p>
        </div>
      ) : (
        <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          <ErrorSummary errors={errors} labels={FIELD_LABELS} order={FIELD_ORDER} message={topError} summaryRef={summaryRef} />

          <section className="panel p-5 sm:p-8">
            <fieldset
              id="field-trialSlotId"
              tabIndex={-1}
              aria-describedby={errors.trialSlotId ? "field-trialSlotId-error" : undefined}
              className="min-w-0 scroll-mt-24 focus:outline-none"
            >
              <legend className="text-xl font-extrabold text-slate-900">Choisissez votre créneau</legend>
              <p className="mt-1 text-[15px] text-slate-700">Un seul créneau par demande.</p>
              <div className="mt-4 space-y-3">
                {slots.map((slot) => {
                  const full = slot.registeredCount >= slot.capacity;
                  const placesLeft = Math.max(0, slot.capacity - slot.registeredCount);
                  return (
                    <ChoiceCard
                      key={slot.id}
                      type="radio"
                      name="trialSlot"
                      value={slot.id}
                      checked={trialSlotId === slot.id}
                      disabled={full}
                      invalid={Boolean(errors.trialSlotId)}
                      onChange={() => {
                        setTrialSlotId(slot.id);
                        clearError("trialSlotId");
                      }}
                    >
                      <span className="block font-bold text-slate-900">{slot.title}</span>
                      <span className="block text-slate-700">{formatTrialSlotDate(slot.startsAt)}</span>
                      <span className={`block text-sm ${full ? "font-bold text-rose-700" : "text-slate-600"}`}>
                        {full
                          ? "Complet"
                          : `${placesLeft} place${placesLeft > 1 ? "s" : ""} restante${placesLeft > 1 ? "s" : ""}`}
                      </span>
                    </ChoiceCard>
                  );
                })}
              </div>
              {errors.trialSlotId ? (
                <p id="field-trialSlotId-error" className="mt-2 text-sm font-semibold text-rose-700">
                  {errors.trialSlotId}
                </p>
              ) : null}
            </fieldset>
          </section>

          <section className="panel p-5 sm:p-8">
            <h2 className="mb-5 text-xl font-extrabold text-slate-900">Vos coordonnées</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <ApplicantIdentityFields
                values={applicant}
                errors={errors}
                disabled={submitting}
                onChange={(key, value) => {
                  setApplicant((previous) => ({ ...previous, [key]: value }));
                  clearError(key);
                }}
              />
              <ApplicantAddressFields
                values={applicant}
                errors={errors}
                disabled={submitting}
                onChange={(key, value) => {
                  setApplicant((previous) => ({ ...previous, [key]: value }));
                  clearError(key);
                }}
              />
            </div>
          </section>

          <section className="panel space-y-6 p-5 sm:p-8">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Votre compte</h2>
              <p className="mt-1 text-[15px] leading-6 text-slate-700">
                Nous confirmons d’abord votre adresse e-mail avec un code, puis vous choisissez un mot de passe.
              </p>
            </div>
            <EmailVerificationField
              email={email}
              onEmailChange={(value) => {
                setEmail(value);
                clearError("email");
              }}
              emailError={errors.email}
              verified={verified}
              onVerified={(result) => {
                setVerification(result);
                clearError("email");
                if (!result.accountExists) focusRequest.current = "field:password";
              }}
              disabled={submitting}
            />
            {accountExists ? <ExistingAccountNotice /> : null}
            {verified && !accountExists ? (
              <div className="border-t border-brand-line pt-6">
                <PasswordFields
                  password={password}
                  passwordConfirm={passwordConfirm}
                  onPasswordChange={(value) => {
                    setPassword(value);
                    clearError("password");
                  }}
                  onPasswordConfirmChange={(value) => {
                    setPasswordConfirm(value);
                    clearError("passwordConfirm");
                  }}
                  passwordError={errors.password}
                  confirmError={errors.passwordConfirm}
                  disabled={submitting}
                />
              </div>
            ) : null}
          </section>

          <section className="panel p-5 sm:p-8">
            <TextAreaField
              name="motivation"
              label="Un message pour le bureau"
              optional
              rows={3}
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              error={errors.motivation}
              disabled={submitting}
            />
          </section>

          <ActionBar
            primaryLabel={submitting ? "Réservation en cours…" : "Réserver ce créneau d’essai"}
            primaryBusy={submitting}
            primaryDisabled={allFull || accountExists}
          />
        </form>
      )}

      <p className="mt-8 text-[15px] text-slate-700">
        Vous souhaitez vous inscrire sans essai ?{" "}
        <Link href="/preinscription" className="font-bold text-brand-blue underline underline-offset-2">
          Pré-inscription complète
        </Link>
      </p>
    </main>
  );
}
