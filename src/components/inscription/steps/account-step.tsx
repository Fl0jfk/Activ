"use client";

import Link from "next/link";
import EmailVerificationField, { type VerifiedEmail } from "@/components/email-verification-field";
import { PasswordFields } from "@/components/forms/account-fields";

type AccountStepProps = {
  email: string;
  onEmailChange: (value: string) => void;
  verified: { verificationId: string; accountExists: boolean } | null;
  /** Le serveur a refusé l'envoi parce qu'un compte existe déjà pour cette adresse. */
  serverAccountExists: boolean;
  onVerified: (result: VerifiedEmail) => void;
  password: string;
  passwordConfirm: string;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  errors: Partial<Record<string, string>>;
  disabled?: boolean;
};

export function ExistingAccountNotice() {
  return (
    <div role="alert" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="text-base font-extrabold">Un compte existe déjà avec cette adresse e-mail</p>
      <p className="mt-1 text-[15px] leading-6">
        Vous vous êtes peut-être déjà inscrit(e) : connectez-vous avec votre mot de passe. Si vous l’avez oublié, utilisez
        « Mot de passe oublié » sur la page de connexion. Vous pouvez aussi saisir une autre adresse e-mail ci-dessus.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Link href="/sign-in" className="btn btn-outline">
          Se connecter
        </Link>
        <Link href="/sign-in?forgot=1" className="btn btn-outline">
          Mot de passe oublié
        </Link>
      </div>
    </div>
  );
}

export default function AccountStep({
  email,
  onEmailChange,
  verified,
  serverAccountExists,
  onVerified,
  password,
  passwordConfirm,
  onPasswordChange,
  onPasswordConfirmChange,
  errors,
  disabled,
}: AccountStepProps) {
  const accountExists = Boolean(verified?.accountExists) || serverAccountExists;
  const showPassword = Boolean(verified) && !accountExists;

  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-6 text-slate-700">
        Votre compte vous permettra de suivre votre dossier, puis d’accéder à votre espace adhérent une fois votre
        inscription validée. Nous commençons par confirmer votre adresse e-mail.
      </p>

      <EmailVerificationField
        email={email}
        onEmailChange={onEmailChange}
        emailError={errors.email}
        verified={verified}
        onVerified={onVerified}
        disabled={disabled}
        resumeHint
      />

      {accountExists ? <ExistingAccountNotice /> : null}

      {showPassword ? (
        <section aria-labelledby="account-password-title" className="space-y-4 border-t border-brand-line pt-6">
          <div>
            <h3 id="account-password-title" className="text-lg font-extrabold text-slate-900">
              Choisissez votre mot de passe
            </h3>
            <p className="mt-1 text-[15px] leading-6 text-slate-700">
              Vous l’utiliserez avec votre adresse e-mail pour vous connecter à votre espace. Notez-le en lieu sûr.
            </p>
          </div>
          <PasswordFields
            password={password}
            passwordConfirm={passwordConfirm}
            onPasswordChange={onPasswordChange}
            onPasswordConfirmChange={onPasswordConfirmChange}
            passwordError={errors.password}
            confirmError={errors.passwordConfirm}
            disabled={disabled}
          />
        </section>
      ) : !verified ? (
        <p className="text-sm text-slate-600">
          Une fois votre adresse confirmée, vous choisirez ici votre mot de passe.
        </p>
      ) : null}
    </div>
  );
}
