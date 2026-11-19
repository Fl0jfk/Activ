"use client";

import { ApplicantAddressFields, ApplicantIdentityFields, type ApplicantFieldValues } from "@/components/forms/applicant-fields";
import { TextField } from "@/components/forms/field-controls";
import type { BulletinValues } from "@/components/inscription/types";

type IdentityStepProps = {
  values: BulletinValues;
  errors: Partial<Record<string, string>>;
  onChange: <K extends keyof BulletinValues>(key: K, value: BulletinValues[K]) => void;
  /** Revalidation : l'adresse e-mail se corrige ici, il n'y a pas d'étape « Votre compte ». */
  withEmail: boolean;
  todayIso: string;
  disabled?: boolean;
};

export default function IdentityStep({ values, errors, onChange, withEmail, todayIso, disabled }: IdentityStepProps) {
  const change = <K extends keyof ApplicantFieldValues>(key: K, value: ApplicantFieldValues[K]) =>
    onChange(key, (value ?? "") as BulletinValues[K]);

  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <ApplicantIdentityFields
          values={values}
          onChange={change}
          errors={errors}
          disabled={disabled}
          withBirthDate
          birthDateMax={todayIso}
        />
        {withEmail ? (
          <TextField
            name="email"
            label="Adresse e-mail"
            className="sm:col-span-2"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={(event) => onChange("email", event.target.value)}
            error={errors.email}
            disabled={disabled}
          />
        ) : null}
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-3 text-lg font-extrabold text-slate-900">Votre adresse</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <ApplicantAddressFields values={values} onChange={change} errors={errors} disabled={disabled} />
        </div>
      </fieldset>
    </div>
  );
}
