"use client";

import { useState } from "react";
import { TextField } from "@/components/forms/field-controls";

export const PASSWORD_MIN_LENGTH = 8;
/** Limite imposée par le service d'authentification (72 octets). */
export const PASSWORD_MAX_LENGTH = 72;

export function evaluatePassword(password: string) {
  return {
    longEnough: password.length >= PASSWORD_MIN_LENGTH,
    hasLetter: /\p{L}/u.test(password),
    hasDigit: /\d/.test(password),
  };
}

export function validatePasswordPair(
  password: string,
  confirm: string,
): { password?: string; passwordConfirm?: string } {
  const errors: { password?: string; passwordConfirm?: string } = {};
  if (!password) {
    errors.password = "Choisissez un mot de passe.";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  }
  if (!confirm) {
    errors.passwordConfirm = "Retapez votre mot de passe pour le confirmer.";
  } else if (confirm !== password) {
    errors.passwordConfirm = "Les deux mots de passe ne sont pas identiques.";
  }
  return errors;
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed ? <path strokeLinecap="round" d="M4 4l16 16" /> : null}
    </svg>
  );
}

type PasswordInputProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  describedByExtra?: string;
  disabled?: boolean;
};

function PasswordInput({ name, label, value, onChange, error, hint, describedByExtra, disabled }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      name={name}
      label={label}
      hint={hint}
      error={error}
      describedByExtra={describedByExtra}
      type={visible ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="new-password"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      maxLength={PASSWORD_MAX_LENGTH}
      disabled={disabled}
      inputClassName="pr-32"
      adornment={
        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
          aria-pressed={visible}
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-brand-blue hover:bg-brand-blue/10"
        >
          <EyeIcon crossed={visible} />
          {visible ? "Masquer" : "Afficher"}
        </button>
      }
    />
  );
}

function Rule({ ok, children, advice = false }: { ok: boolean; children: string; advice?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? "text-brand-green-dark" : "text-slate-700"}`}>
      <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center font-bold">
        {ok ? "✓" : "○"}
      </span>
      <span>
        {children}
        {advice ? " (conseillé)" : ""}
        <span className="sr-only">{ok ? " : respecté" : " : pas encore respecté"}</span>
      </span>
    </li>
  );
}

type PasswordFieldsProps = {
  password: string;
  passwordConfirm: string;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  passwordError?: string;
  confirmError?: string;
  disabled?: boolean;
};

/** Mot de passe + confirmation, avec règles qui se cochent en direct et bouton afficher/masquer. */
export function PasswordFields({
  password,
  passwordConfirm,
  onPasswordChange,
  onPasswordConfirmChange,
  passwordError,
  confirmError,
  disabled,
}: PasswordFieldsProps) {
  const rules = evaluatePassword(password);
  const confirmTouched = passwordConfirm.length > 0;
  const matches = confirmTouched && passwordConfirm === password;

  return (
    <div className="space-y-4">
      <PasswordInput
        name="password"
        label="Mot de passe"
        value={password}
        onChange={onPasswordChange}
        error={passwordError}
        describedByExtra="password-rules"
        disabled={disabled}
      />
      <ul id="password-rules" className="space-y-1 rounded-xl bg-brand-cream px-4 py-3 text-sm">
        <Rule ok={rules.longEnough}>{`Au moins ${PASSWORD_MIN_LENGTH} caractères`}</Rule>
        <Rule ok={rules.hasLetter} advice>
          Des lettres
        </Rule>
        <Rule ok={rules.hasDigit} advice>
          Des chiffres
        </Rule>
      </ul>
      <PasswordInput
        name="passwordConfirm"
        label="Confirmez le mot de passe"
        value={passwordConfirm}
        onChange={onPasswordConfirmChange}
        error={confirmError}
        describedByExtra="password-match"
        disabled={disabled}
      />
      <p
        id="password-match"
        aria-live="polite"
        className={`min-h-5 text-sm font-semibold ${matches ? "text-brand-green-dark" : "text-slate-600"}`}
      >
        {matches ? "✓ Les deux mots de passe sont identiques." : ""}
      </p>
    </div>
  );
}
