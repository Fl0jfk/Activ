"use client";

import { useState } from "react";

type EmailVerificationFieldProps = {
  email: string;
  /** Identifiant renvoyé par l'API une fois le code validé. */
  verificationId: string | null;
  onVerified: (verificationId: string | null) => void;
  disabled?: boolean;
};

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(email));
}

/**
 * Envoie un code à 6 chiffres sur l'adresse saisie et le fait valider.
 * Tant que l'adresse n'est pas confirmée, l'inscription ne peut pas être envoyée.
 */
export default function EmailVerificationField({
  email,
  verificationId,
  onVerified,
  disabled = false,
}: EmailVerificationFieldProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentEmail = normalize(email);
  const awaitingCode = sentTo !== null && sentTo === currentEmail;

  async function sendCode() {
    if (!looksLikeEmail(currentEmail)) {
      setError("Saisissez d'abord une adresse e-mail valide.");
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public-email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Impossible d'envoyer le code.");
        return;
      }
      setSentTo(currentEmail);
      setCode("");
      setMessage(payload.message ?? "Code envoyé. Vérifiez votre boîte mail.");
    } catch {
      setError("Impossible d'envoyer le code. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  }

  async function confirmCode() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Saisissez les 6 chiffres reçus par e-mail.");
      return;
    }
    setVerifying(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public-email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail, code: code.trim() }),
      });
      const payload = (await response.json()) as {
        message?: string;
        verificationId?: string;
      };
      if (!response.ok || !payload.verificationId) {
        setError(payload.message ?? "Code incorrect.");
        return;
      }
      onVerified(payload.verificationId);
      setMessage(payload.message ?? "Adresse e-mail vérifiée.");
    } catch {
      setError("Impossible de vérifier le code. Réessayez dans un instant.");
    } finally {
      setVerifying(false);
    }
  }

  if (verificationId) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
        ✓ Adresse e-mail vérifiée
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void sendCode()}
          disabled={disabled || sending || !looksLikeEmail(currentEmail)}
          className="rounded-xl border border-cyan-700 bg-white px-3 py-2 text-sm font-semibold text-cyan-800 disabled:opacity-50"
        >
          {sending
            ? "Envoi…"
            : awaitingCode
              ? "Renvoyer un code"
              : "Recevoir mon code de vérification"}
        </button>
        <span className="text-xs text-slate-500">
          Obligatoire pour confirmer que la boîte mail existe.
        </span>
      </div>

      {awaitingCode ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Code reçu (6 chiffres)
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              disabled={disabled || verifying}
              className="w-32 rounded-xl border border-slate-300 px-3 py-2 font-mono text-base tracking-widest"
            />
          </label>
          <button
            type="button"
            onClick={() => void confirmCode()}
            disabled={disabled || verifying || code.length !== 6}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {verifying ? "Vérification…" : "Valider mon adresse"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {!error && message ? (
        <p className="text-sm font-medium text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}
