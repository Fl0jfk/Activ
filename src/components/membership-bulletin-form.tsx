"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ErrorSummary, { focusField, focusFirstError, type FieldErrors } from "@/components/forms/error-summary";
import { normalizeEmail, todayLocalIso } from "@/components/forms/validators";
import type { VerifiedEmail } from "@/components/email-verification-field";
import ActionBar from "@/components/inscription/action-bar";
import { buildBulletinPayload } from "@/components/inscription/payload";
import { AlreadyReceivedScreen, InvalidLinkScreen, RevalidatedScreen } from "@/components/inscription/result-screens";
import StepProgress from "@/components/inscription/step-progress";
import AccountStep from "@/components/inscription/steps/account-step";
import ActivitiesStep from "@/components/inscription/steps/activities-step";
import CommitmentsStep from "@/components/inscription/steps/commitments-step";
import EmergencyStep from "@/components/inscription/steps/emergency-step";
import IdentityStep from "@/components/inscription/steps/identity-step";
import ReviewStep, { type PreviewState } from "@/components/inscription/steps/review-step";
import SignatureStep from "@/components/inscription/steps/signature-step";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  NEW_MEMBER_STEPS,
  REVALIDATION_STEPS,
  STEP_INFO,
  stepOfField,
} from "@/components/inscription/steps-config";
import {
  clearDraft,
  clearVerification,
  parseDraft,
  parseVerification,
  saveDone,
  saveDraft,
  saveVerification,
  useDraftRaw,
  useVerificationRaw,
  type DraftValues,
} from "@/components/inscription/storage";
import type { BulletinValues, StepContext, StepId } from "@/components/inscription/types";
import { useTodayIso } from "@/components/inscription/use-today";
import { validateStep } from "@/components/inscription/validation";
import type { SignatureValue } from "@/components/signature-pad";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import type { MembershipActivityOption } from "@/lib/membership-activities";
import {
  MEMBERSHIP_SEASON_LABEL,
  computeMembershipTotals,
  type MembershipImageRights,
  type MembershipPaymentPlan,
} from "@/lib/membership-bulletin";

type MembershipBulletinFormProps = {
  activityOptions: MembershipActivityOption[];
  initialDisciplineId?: string;
  revalidateToken?: string;
};

type SubmitResponse = {
  ok?: boolean;
  message?: string;
  alreadyReceived?: boolean;
  code?: string;
  fieldErrors?: Record<string, string>;
};

type TokenData = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  email?: string;
  birthDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  selectedSlots?: string[];
  paymentPlan?: MembershipPaymentPlan;
  imageRights?: MembershipImageRights;
  signedPlace?: string;
};

type TokenState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string; retryable: boolean };

type Outcome = { kind: "already"; message: string } | { kind: "revalidated" } | null;

type FocusRequest = "heading" | "error" | "summary" | `field:${string}`;

const DEFAULT_SIGNED_PLACE = "Sainte-Croix";

function buildInitialValues(options: MembershipActivityOption[], initialDisciplineId?: string): BulletinValues {
  const matched = initialDisciplineId
    ? options.find((option) => option.disciplineId === initialDisciplineId)
    : undefined;
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    selectedSlots: matched ? [matched.id] : [],
    paymentPlan: "once",
    imageRights: "",
    acceptRules: false,
    acceptHealth: false,
    acceptInsurance: false,
    acceptRefund: false,
    signedPlace: DEFAULT_SIGNED_PLACE,
    signedAt: "",
  };
}

function toDraftValues(values: BulletinValues): DraftValues {
  const { signedAt, ...rest } = values;
  void signedAt;
  return rest;
}

export default function MembershipBulletinForm({
  activityOptions,
  initialDisciplineId,
  revalidateToken,
}: MembershipBulletinFormProps) {
  const router = useRouter();
  const isRevalidation = Boolean(revalidateToken);
  const steps = isRevalidation ? REVALIDATION_STEPS : NEW_MEMBER_STEPS;

  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<BulletinValues>(() => buildInitialValues(activityOptions, initialDisciplineId));
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [serverAccountEmail, setServerAccountEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [tokenState, setTokenState] = useState<TokenState>(
    revalidateToken ? { status: "loading" } : { status: "ready" },
  );
  const [tokenAttempt, setTokenAttempt] = useState(0);

  const submittingRef = useRef(false);
  const finishedRef = useRef(false);
  const previewSeqRef = useRef(0);
  const focusRequest = useRef<FocusRequest | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const todayIso = useTodayIso();
  const stepId: StepId = steps[stepIndex] ?? "identity";
  const stepInfo = STEP_INFO[stepId];
  const isLastStep = stepId === "review";

  const knownSlotIds = useMemo(() => new Set(activityOptions.map((option) => option.id)), [activityOptions]);

  const verificationRaw = useVerificationRaw();
  const storedVerification = useMemo(() => parseVerification(verificationRaw), [verificationRaw]);
  const normalizedEmail = normalizeEmail(values.email);
  const verification =
    !isRevalidation && storedVerification && storedVerification.email === normalizedEmail
      ? { verificationId: storedVerification.id, accountExists: storedVerification.accountExists }
      : null;
  const serverAccountExists = serverAccountEmail !== null && serverAccountEmail === normalizedEmail;
  const accountExists = Boolean(verification?.accountExists) || serverAccountExists;

  const draftRaw = useDraftRaw();
  const draft = useMemo(
    () => (isRevalidation ? null : parseDraft(draftRaw, knownSlotIds)),
    [isRevalidation, draftRaw, knownSlotIds],
  );
  const showDraftBanner = draft !== null && !dirty && stepIndex === 0;

  /* Chargement des données du lien de revalidation. */
  useEffect(() => {
    if (!revalidateToken) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchJson<TokenData>(
        `/api/public-membership-bulletin/revalidate?token=${encodeURIComponent(revalidateToken)}`,
      );
      if (cancelled) return;
      const data = result.data;
      if (!result.ok || !data) {
        setTokenState({
          status: "error",
          message: result.message || "Lien de revalidation invalide.",
          retryable: result.status === 0 || result.status >= 500,
        });
        return;
      }
      setValues((previous) => ({
        ...previous,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        phone: data.phone ?? "",
        address: data.address ?? "",
        postalCode: data.postalCode ?? "",
        city: data.city ?? "",
        email: data.email ?? "",
        birthDate: data.birthDate ?? "",
        emergencyContactName: data.emergencyContactName ?? "",
        emergencyContactPhone: data.emergencyContactPhone ?? "",
        selectedSlots: Array.isArray(data.selectedSlots) ? data.selectedSlots : [],
        paymentPlan: data.paymentPlan === "three_times" ? "three_times" : "once",
        imageRights: data.imageRights === "refuse" || data.imageRights === "authorize" ? data.imageRights : "",
        signedPlace: data.signedPlace?.trim() || DEFAULT_SIGNED_PLACE,
      }));
      setTokenState({ status: "ready" });
    })();
    return () => {
      cancelled = true;
    };
  }, [revalidateToken, tokenAttempt]);

  /* Sauvegarde automatique du brouillon (jamais le mot de passe, la signature ni le code reçu). */
  useEffect(() => {
    if (!dirty || isRevalidation) return;
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return;
      saveDraft(steps[stepIndex] ?? "identity", toDraftValues(values));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [dirty, isRevalidation, values, stepIndex, steps]);

  /* Libère l'adresse temporaire de l'aperçu PDF dès qu'elle n'est plus affichée. */
  useEffect(() => {
    if (preview.status !== "ready") return;
    const url = preview.url;
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  /* Défilement et focus après un changement d'étape ou une erreur. */
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    if (request === "heading") {
      focusRequest.current = null;
      topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      headingRef.current?.focus({ preventScroll: true });
    } else if (request === "error") {
      focusRequest.current = null;
      if (!focusFirstError(errors, FIELD_ORDER)) summaryRef.current?.focus();
    } else if (request === "summary") {
      focusRequest.current = null;
      summaryRef.current?.focus();
    } else if (focusField(request.slice("field:".length))) {
      focusRequest.current = null;
    }
  });

  function makeContext(overrides?: Partial<StepContext>): StepContext {
    return {
      revalidation: isRevalidation,
      emailVerified: Boolean(verification),
      accountExists,
      password,
      passwordConfirm,
      hasSignature: signature !== null,
      ...overrides,
    };
  }

  function setValue<K extends keyof BulletinValues>(key: K, value: BulletinValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setErrors((previous) => {
      const stale = [key as string, ...(String(key).startsWith("accept") ? ["commitments"] : [])];
      if (!stale.some((name) => previous[name])) return previous;
      const next = { ...previous };
      for (const name of stale) delete next[name];
      return next;
    });
  }

  function clearError(key: string) {
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function toggleSlot(slotId: string) {
    setValue(
      "selectedSlots",
      values.selectedSlots.includes(slotId)
        ? values.selectedSlots.filter((id) => id !== slotId)
        : [...values.selectedSlots, slotId],
    );
  }

  async function loadPreview() {
    if (!signature) return;
    const seq = (previewSeqRef.current += 1);
    setPreview({ status: "loading" });
    try {
      const response = await fetch(
        "/api/public-membership-bulletin/preview",
        jsonInit("POST", buildBulletinPayload(values, signature.dataUrl)),
      );
      if (seq !== previewSeqRef.current) return;
      if (!response.ok) {
        let message = "";
        try {
          message = ((await response.json()) as { message?: string }).message ?? "";
        } catch {
          message = "";
        }
        setPreview({ status: "error", message: message || "Impossible de préparer l’aperçu du PDF. Réessayez." });
        return;
      }
      const blob = await response.blob();
      if (seq !== previewSeqRef.current) return;
      const pdf = new Blob([blob], { type: "application/pdf" });
      setPreview({ status: "ready", url: URL.createObjectURL(pdf) });
    } catch {
      if (seq !== previewSeqRef.current) return;
      setPreview({ status: "error", message: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
    }
  }

  function goToStep(target: StepId, options?: { keepErrors?: boolean }) {
    const index = steps.indexOf(target);
    if (index < 0) return;
    if (target === "signature") {
      setValues((previous) => (previous.signedAt ? previous : { ...previous, signedAt: todayLocalIso() }));
    }
    setStepIndex(index);
    if (!options?.keepErrors) {
      setErrors({});
      setTopError("");
    }
    focusRequest.current = "heading";
    if (target === "review") void loadPreview();
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    setTopError("");
    focusRequest.current = "error";
  }

  function advance() {
    const stepErrors = validateStep(stepId, values, makeContext());
    if (Object.keys(stepErrors).length > 0) {
      showErrors(stepErrors);
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) goToStep(next);
  }

  function handleServerFailure(result: { message: string; data: SubmitResponse | null }) {
    const code = result.data?.code;
    const fieldErrors = result.data?.fieldErrors ?? {};
    const accountStep: StepId = isRevalidation ? "identity" : "account";

    if (code === "existing_account") {
      setServerAccountEmail(normalizedEmail);
      goToStep(accountStep, { keepErrors: true });
      showErrors({ email: result.message || "Un compte existe déjà avec cette adresse e-mail." });
      return;
    }
    if (code === "email_not_verified") {
      clearVerification();
      goToStep(accountStep, { keepErrors: true });
      showErrors({ email: "Votre adresse e-mail n’est plus confirmée. Demandez un nouveau code pour continuer." });
      return;
    }
    if (code === "password_invalid" && !fieldErrors.password) {
      goToStep("account", { keepErrors: true });
      showErrors({ password: result.message || "Ce mot de passe n’est pas accepté. Choisissez-en un autre." });
      return;
    }

    const mapped: FieldErrors = {};
    const unmapped: string[] = [];
    let earliest = Number.POSITIVE_INFINITY;
    for (const [key, message] of Object.entries(fieldErrors)) {
      const target = stepOfField(key, isRevalidation);
      const index = target ? steps.indexOf(target) : -1;
      if (index < 0) {
        unmapped.push(message);
        continue;
      }
      mapped[key] = message;
      earliest = Math.min(earliest, index);
    }
    if (Object.keys(mapped).length > 0) {
      goToStep(steps[earliest]!, { keepErrors: true });
      setErrors(mapped);
      setTopError(unmapped.join(" "));
      focusRequest.current = "error";
      return;
    }

    setTopError(result.message || "L’envoi a échoué. Vérifiez votre connexion puis réessayez.");
    focusRequest.current = "summary";
  }

  async function send() {
    if (submittingRef.current) return;

    const context = makeContext();
    for (const step of steps) {
      if (step === "review") continue;
      const stepErrors = validateStep(step, values, context);
      if (Object.keys(stepErrors).length > 0) {
        goToStep(step);
        showErrors(stepErrors);
        return;
      }
    }
    if (!signature) return;

    submittingRef.current = true;
    setSubmitting(true);
    setTopError("");
    setErrors({});

    const base = buildBulletinPayload(values, signature.dataUrl);
    const endpoint = isRevalidation
      ? "/api/public-membership-bulletin/revalidate"
      : "/api/public-preinscriptions";
    const body = isRevalidation
      ? { ...base, token: revalidateToken }
      : { ...base, password, emailVerificationId: verification?.verificationId, bulletinMode: true };

    const result = await fetchJson<SubmitResponse>(endpoint, jsonInit("POST", body));

    if (!result.ok) {
      submittingRef.current = false;
      setSubmitting(false);
      handleServerFailure(result);
      return;
    }

    finishedRef.current = true;
    if (isRevalidation) {
      submittingRef.current = false;
      setSubmitting(false);
      setOutcome({ kind: "revalidated" });
      return;
    }

    clearDraft();
    clearVerification();
    if (result.data?.alreadyReceived) {
      submittingRef.current = false;
      setSubmitting(false);
      setOutcome({ kind: "already", message: result.message });
      return;
    }
    saveDone({
      firstName: base.firstName,
      email: base.email,
      paymentPlan: base.paymentPlan,
      grandTotal: computeMembershipTotals(base.selectedSlots).grandTotal,
    });
    router.replace("/preinscription/merci");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || tokenState.status !== "ready") return;
    if (isLastStep) void send();
    else advance();
  }

  function handleVerified(result: VerifiedEmail) {
    saveVerification({ id: result.verificationId, email: result.email, accountExists: result.accountExists });
    clearError("email");
    setTopError("");
    if (!result.accountExists) focusRequest.current = "field:password";
  }

  function restoreDraft() {
    if (!draft) return;
    const restored: BulletinValues = { ...values, ...draft.values, signedAt: "" };
    const savedIndex = Math.max(0, steps.indexOf(draft.step as StepId));
    const restoredEmail = normalizeEmail(restored.email);
    const context = makeContext({
      emailVerified: storedVerification?.email === restoredEmail,
      accountExists: Boolean(storedVerification?.email === restoredEmail && storedVerification.accountExists),
      password: "",
      passwordConfirm: "",
      hasSignature: false,
    });
    let target = 0;
    for (let index = 0; index < savedIndex; index += 1) {
      if (Object.keys(validateStep(steps[index]!, restored, context)).length > 0) break;
      target = index + 1;
    }
    setValues(restored);
    setDirty(true);
    setErrors({});
    setTopError("");
    setStepIndex(target);
    focusRequest.current = "heading";
  }

  function discardDraft() {
    clearDraft();
    clearVerification();
  }

  function retryToken() {
    setTokenState({ status: "loading" });
    setTokenAttempt((attempt) => attempt + 1);
  }

  if (outcome?.kind === "already") return <AlreadyReceivedScreen message={outcome.message} />;
  if (outcome?.kind === "revalidated") return <RevalidatedScreen />;
  if (tokenState.status === "error") {
    return (
      <InvalidLinkScreen
        message={tokenState.message}
        title={tokenState.retryable ? "Chargement impossible" : undefined}
        onRetry={tokenState.retryable ? retryToken : undefined}
      />
    );
  }

  const busy = submitting || tokenState.status === "loading";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-6">
        <span className="eyebrow">{isRevalidation ? "Revalidation" : "Pré-inscription"}</span>
        <h1 className="section-title mt-2">Bulletin d’adhésion</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-700">
          {isRevalidation
            ? `Revalidation de votre bulletin — ${MEMBERSHIP_SEASON_LABEL}. Vérifiez vos informations, signez, puis confirmez l’envoi.`
            : `Activ’ Sainte-Croix Sport et Culture — ${MEMBERSHIP_SEASON_LABEL}. Répondez aux questions étape par étape, signez, puis envoyez votre dossier.`}{" "}
          Besoin d’aide ? Appelez le{" "}
          <a href={ASSOCIATION_PHONE_TEL} className="font-bold text-brand-blue underline underline-offset-2">
            {ASSOCIATION_PHONE_DISPLAY}
          </a>
          .
        </p>
      </header>

      {showDraftBanner && draft ? (
        <section
          aria-labelledby="draft-banner-title"
          className="mb-6 rounded-2xl border-2 border-brand-blue/30 bg-brand-blue/5 p-4 sm:p-5"
        >
          <h2 id="draft-banner-title" className="text-lg font-extrabold text-brand-blue-dark">
            Vous aviez commencé une inscription
          </h2>
          <p className="mt-1 text-[15px] leading-6 text-slate-700">
            Vos réponses ont été conservées sur cet appareil
            {draft.savedAt
              ? ` (enregistrées le ${new Date(draft.savedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })})`
              : ""}
            . Pour votre sécurité, le mot de passe et la signature ne sont jamais enregistrés : vous les saisirez à nouveau.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={restoreDraft} className="btn btn-primary">
              Reprendre ma saisie
            </button>
            <button type="button" onClick={discardDraft} className="btn btn-ghost">
              Recommencer à zéro
            </button>
          </div>
        </section>
      ) : null}

      {tokenState.status === "loading" ? (
        <p role="status" className="panel p-6 text-[15px] font-semibold text-slate-700">
          Chargement de votre dossier…
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit} aria-labelledby="step-heading">
          <div ref={topRef} className="anchor-section">
            <StepProgress steps={steps} current={stepIndex} disabled={busy} onGoTo={(index) => goToStep(steps[index]!)} />
          </div>

          <ErrorSummary errors={errors} labels={FIELD_LABELS} order={FIELD_ORDER} message={topError} summaryRef={summaryRef} />

          <section className="panel p-5 sm:p-8">
            <h2
              id="step-heading"
              ref={headingRef}
              tabIndex={-1}
              className="mb-5 text-2xl font-extrabold tracking-tight text-slate-900 focus:outline-none"
            >
              {stepInfo.title}
            </h2>

            {stepId === "identity" ? (
              <>
                {!isRevalidation ? (
                  <div className="mb-6 rounded-2xl bg-brand-cream p-4 text-[15px] leading-6 text-slate-700 ring-1 ring-brand-line">
                    <p className="font-bold text-slate-900">Avant de commencer</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>Comptez une dizaine de minutes. Tous les champs sont obligatoires.</li>
                      <li>Gardez votre téléphone ou votre ordinateur à portée : un code vous sera envoyé par e-mail.</li>
                      <li>
                        Vous pouvez quitter la page et revenir : vos réponses sont conservées sur cet appareil et effacées
                        dès l’envoi.
                      </li>
                    </ul>
                  </div>
                ) : null}
                <IdentityStep
                  values={values}
                  errors={errors}
                  onChange={setValue}
                  withEmail={isRevalidation}
                  todayIso={todayIso}
                  disabled={busy}
                />
              </>
            ) : null}

            {stepId === "emergency" ? (
              <EmergencyStep values={values} errors={errors} onChange={setValue} disabled={busy} />
            ) : null}

            {stepId === "account" ? (
              <AccountStep
                email={values.email}
                onEmailChange={(value) => setValue("email", value)}
                verified={verification}
                serverAccountExists={serverAccountExists}
                onVerified={handleVerified}
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
                errors={errors}
                disabled={busy}
              />
            ) : null}

            {stepId === "activities" ? (
              <ActivitiesStep
                options={activityOptions}
                selectedSlots={values.selectedSlots}
                paymentPlan={values.paymentPlan}
                errors={errors}
                onToggleSlot={toggleSlot}
                onPaymentPlanChange={(plan) => setValue("paymentPlan", plan)}
              />
            ) : null}

            {stepId === "commitments" ? (
              <CommitmentsStep values={values} errors={errors} onChange={setValue} />
            ) : null}

            {stepId === "signature" ? (
              <SignatureStep
                values={values}
                errors={errors}
                onChange={setValue}
                signature={signature}
                onSignatureChange={(value) => {
                  setSignature(value);
                  if (value) clearError("signature");
                }}
                todayIso={todayIso}
                disabled={busy}
              />
            ) : null}

            {stepId === "review" && signature ? (
              <ReviewStep
                values={values}
                options={activityOptions}
                signatureDataUrl={signature.dataUrl}
                preview={preview}
                onRetryPreview={() => void loadPreview()}
                onEdit={(target) => goToStep(target)}
                revalidation={isRevalidation}
              />
            ) : null}
          </section>

          <ActionBar
            onBack={stepIndex > 0 ? () => goToStep(steps[stepIndex - 1]!) : undefined}
            backDisabled={busy}
            primaryLabel={
              isLastStep
                ? submitting
                  ? "Envoi en cours…"
                  : isRevalidation
                    ? "Confirmer et envoyer"
                    : "Envoyer mon inscription"
                : "Continuer"
            }
            primaryBusy={busy}
            primaryDisabled={stepId === "account" && accountExists}
          />
        </form>
      )}
    </main>
  );
}
