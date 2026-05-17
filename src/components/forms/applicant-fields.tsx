"use client";

import { FormField, FormInput } from "@/components/forms/form-field";

export type ApplicantFieldValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  password: string;
  passwordConfirm: string;
};

type ApplicantFieldsProps = {
  values: ApplicantFieldValues;
  onChange: <K extends keyof ApplicantFieldValues>(key: K, value: ApplicantFieldValues[K]) => void;
  showPassword?: boolean;
  disabled?: boolean;
  emailRequired?: boolean;
};

export function ApplicantIdentityFields({
  values,
  onChange,
  showPassword = false,
  disabled = false,
  emailRequired = true,
}: ApplicantFieldsProps) {
  return (
    <>
      <FormField label="Prénom">
        <FormInput
          value={values.firstName}
          onChange={(e) => onChange("firstName", e.target.value)}
          required
          disabled={disabled}
        />
      </FormField>
      <FormField label="Nom">
        <FormInput
          value={values.lastName}
          onChange={(e) => onChange("lastName", e.target.value)}
          required
          disabled={disabled}
        />
      </FormField>
      <FormField label="Téléphone">
        <FormInput
          type="tel"
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          required
          disabled={disabled}
        />
      </FormField>
      <FormField label="E-mail">
        <FormInput
          type="email"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          required={emailRequired}
          disabled={disabled}
        />
      </FormField>
      {showPassword ? (
        <>
          <FormField label="Mot de passe">
            <FormInput
              type="password"
              value={values.password}
              onChange={(e) => onChange("password", e.target.value)}
              minLength={8}
              required
              disabled={disabled}
            />
          </FormField>
          <FormField label="Confirmer le mot de passe">
            <FormInput
              type="password"
              value={values.passwordConfirm}
              onChange={(e) => onChange("passwordConfirm", e.target.value)}
              minLength={8}
              required
              disabled={disabled}
            />
          </FormField>
        </>
      ) : null}
    </>
  );
}

export function ApplicantAddressFields({ values, onChange, disabled = false }: ApplicantFieldsProps) {
  return (
    <>
      <FormField label="Adresse" className="sm:col-span-2">
        <FormInput
          value={values.address}
          onChange={(e) => onChange("address", e.target.value)}
          required
          disabled={disabled}
        />
      </FormField>
      <FormField label="Code postal">
        <FormInput
          value={values.postalCode}
          onChange={(e) => onChange("postalCode", e.target.value)}
          required
          disabled={disabled}
        />
      </FormField>
      <FormField label="Ville">
        <FormInput
          value={values.city}
          onChange={(e) => onChange("city", e.target.value)}
          required
          disabled={disabled}
        />
      </FormField>
    </>
  );
}
