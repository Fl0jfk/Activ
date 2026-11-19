"use client";

import { useEffect, useRef, useState } from "react";
import { StatusMessage, type Feedback } from "@/components/bureau-ui";
import { TextField } from "@/components/forms/field-controls";
import { isValidEmail, normalizeEmail } from "@/components/forms/validators";
import { fetchJson, jsonInit } from "@/lib/fetch-json";

export type VerifiedEmail = {
  verificationId: string;
  email: string;
  accountExists: boolean;
};

type EmailVerificationFieldProps = {
  email: string;
  onEmailChange: (value: string) => void;
  emailError?: string;
  /** Vérification en cours de validité pour l'adresse saisie, sinon null. */
  verified: { verificationId: string; accountExists: boolean } | null;
  onVerified: (result: VerifiedEmail) => void;
  disabled?: boolean;
  /** Précise que la saisie du formulaire est conservée si l'on quitte la page pour lire l'e-mail. */
  resumeHint?: boolean;
};

type SendResponse = { message?: string; retryAfterSeconds?: number };
type ConfirmResponse = { message?: string; verificationId?: string; accountExists?: boolean };

const DEFAULT_RESEND_SECONDS = 60;

/**
 * Saisie de l'adresse e-mail + code à 6 chiffres reçu par e-mail.
 * Le champ e-mail fait partie du composant : Entrée envoie le code (ou le valide) au lieu de soumettre le formulaire.
 */
export default function EmailVerificationField({
  email,
  onEmailChange,
  emailError,
  verified,
  onVerified,
  disabled = false,
  resumeHint = false,
}: EmailVerificationFieldProps) {
  const [sent, setSent] = useState<{ email: string; resendAt: number } | null>(null);
  const [now, setNow] = useState(0);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [codeError, setCodeError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  const currentEmail = normalizeEmail(email);
  const emailValid = isValidEmail(currentEmail);
  const awaitingCode = sent !== null && sent.email === currentEmail;
  const secondsLeft = awaitingCode ? Math.max(0, Math.ceil((sent.resendAt - now) / 1000)) : 0;
  const counting = secondsLeft > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [counting]);

  useEffect(() => {
    if (awaitingCode && !verified) codeRef.current?.focus();
  }, [awaitingCode, verified]);

  function startCountdown(seconds: number) {
    const start = Date.now();
    setNow(start);
    setSent({ email: currentEmail, resendAt: start + seconds * 1000 });
  }

  async function sendCode() {
    if (sending || counting) return;
    if (!emailValid) {
      setFeedback({ tone: "error", text: "Indiquez d’abord une adresse e-mail valide." });
      return;
    }
    setSending(true);
    setFeedback(null);
    setCodeError("");
    const result = await fetchJson<SendResponse>("/api/public-email-verification", jsonInit("POST", { email: currentEmail }));
    setSending(false);
    const retry = result.data?.retryAfterSeconds;
    if (result.ok) {
      startCountdown(retry && retry > 0 ? retry : DEFAULT_RESEND_SECONDS);
      setCode("");
      setFeedback({
        tone: "success",
        text: `Un code à 6 chiffres vient d’être envoyé à ${currentEmail}. Pensez à regarder dans vos courriers indésirables.`,
      });
      return;
    }
    if (result.status === 429) {
      startCountdown(retry && retry > 0 ? retry : DEFAULT_RESEND_SECONDS);
    }
    setFeedback({ tone: "error", text: result.message || "Impossible d’envoyer le code. Réessayez dans un instant." });
  }

  async function confirmCode() {
    if (verifying) return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setCodeError("Saisissez les 6 chiffres reçus par e-mail.");
      return;
    }
    setVerifying(true);
    setCodeError("");
    setFeedback(null);
    const result = await fetchJson<ConfirmResponse>(
      "/api/public-email-verification/confirm",
      jsonInit("POST", { email: currentEmail, code: trimmed }),
    );
    setVerifying(false);
    const verificationId = result.data?.verificationId;
    if (!result.ok || !verificationId) {
      setCodeError(result.message || "Code incorrect. Vérifiez les 6 chiffres reçus.");
      return;
    }
    setCode("");
    setSent(null);
    onVerified({ verificationId, email: currentEmail, accountExists: result.data?.accountExists === true });
  }

  return (
    <div className="space-y-4">
      <TextField
        name="email"
        label="Adresse e-mail"
        hint="Vous recevrez ici un code de confirmation, puis les nouvelles de votre dossier."
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={email}
        onChange={(event) => {
          onEmailChange(event.target.value);
          setCodeError("");
          setFeedback(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || verified) return;
          event.preventDefault();
          void sendCode();
        }}
        error={emailError}
        disabled={disabled}
      />

      {verified ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-[15px] font-bold text-emerald-900 ring-1 ring-emerald-200">
          ✓ Adresse e-mail confirmée
        </p>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={disabled || sending || counting || !emailValid}
            className="btn btn-outline w-full sm:w-auto"
          >
            {sending
              ? "Envoi du code…"
              : awaitingCode
                ? counting
                  ? `Renvoyer le code dans ${secondsLeft} s`
                  : "Renvoyer le code"
                : "Recevoir mon code par e-mail"}
          </button>

          <StatusMessage feedback={feedback} />

          {awaitingCode ? (
            <div className="rounded-2xl border border-brand-line bg-brand-cream p-4">
              <TextField
                name="emailCode"
                label="Code reçu par e-mail"
                hint={`6 chiffres.${resumeHint ? " Vous pouvez quitter cette page pour lire votre e-mail, puis revenir ici : votre saisie est conservée." : ""}`}
                inputRef={codeRef}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setCodeError("");
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void confirmCode();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                error={codeError}
                disabled={disabled || verifying}
                inputClassName="max-w-56 text-center font-mono text-2xl tracking-[0.35em]"
              />
              <button
                type="button"
                onClick={() => void confirmCode()}
                disabled={disabled || verifying || code.length !== 6}
                className="btn btn-outline mt-4 w-full sm:w-auto"
              >
                {verifying ? "Vérification…" : "Valider mon adresse"}
              </button>
              <p className="mt-3 text-sm text-slate-600">
                {counting
                  ? `Vous pourrez demander un nouveau code dans ${secondsLeft} seconde${secondsLeft > 1 ? "s" : ""}.`
                  : "Rien reçu ? Vérifiez vos courriers indésirables, ou demandez un nouveau code ci-dessus."}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
