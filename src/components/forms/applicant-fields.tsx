"use client";

import { TextField } from "@/components/forms/field-controls";

export type ApplicantFieldValues = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  birthDate?: string;
};

type ApplicantFieldsProps = {
  values: ApplicantFieldValues;
  onChange: <K extends keyof ApplicantFieldValues>(key: K, value: ApplicantFieldValues[K]) => void;
  errors?: Partial<Record<string, string>>;
  disabled?: boolean;
  /** Ajoute le champ « Date de naissance » (bulletin d'adhésion). */
  withBirthDate?: boolean;
  /** Date maximale autorisée pour la naissance (aujourd'hui), si connue. */
  birthDateMax?: string;
};

/** Prénom, nom, (date de naissance) et téléphone. */
export function ApplicantIdentityFields({
  values,
  onChange,
  errors = {},
  disabled = false,
  withBirthDate = false,
  birthDateMax,
}: ApplicantFieldsProps) {
  return (
    <>
      <TextField
        name="firstName"
        label="Prénom"
        value={values.firstName}
        onChange={(event) => onChange("firstName", event.target.value)}
        error={errors.firstName}
        autoComplete="given-name"
        enterKeyHint="next"
        disabled={disabled}
      />
      <TextField
        name="lastName"
        label="Nom"
        value={values.lastName}
        onChange={(event) => onChange("lastName", event.target.value)}
        error={errors.lastName}
        autoComplete="family-name"
        enterKeyHint="next"
        disabled={disabled}
      />
      {withBirthDate ? (
        <TextField
          name="birthDate"
          label="Date de naissance"
          hint="Jour, mois et année."
          type="date"
          value={values.birthDate ?? ""}
          onChange={(event) => onChange("birthDate", event.target.value)}
          error={errors.birthDate}
          autoComplete="bday"
          min="1900-01-01"
          max={birthDateMax || undefined}
          disabled={disabled}
        />
      ) : null}
      <TextField
        name="phone"
        label="Téléphone"
        type="tel"
        inputMode="tel"
        value={values.phone}
        onChange={(event) => onChange("phone", event.target.value)}
        error={errors.phone}
        autoComplete="tel"
        enterKeyHint="next"
        disabled={disabled}
      />
    </>
  );
}

/** Adresse, code postal et commune. */
export function ApplicantAddressFields({ values, onChange, errors = {}, disabled = false }: ApplicantFieldsProps) {
  return (
    <>
      <TextField
        name="address"
        label="Adresse"
        hint="Numéro et nom de la rue."
        className="sm:col-span-2"
        value={values.address}
        onChange={(event) => onChange("address", event.target.value)}
        error={errors.address}
        autoComplete="street-address"
        enterKeyHint="next"
        disabled={disabled}
      />
      <TextField
        name="postalCode"
        label="Code postal"
        inputMode="numeric"
        maxLength={5}
        value={values.postalCode}
        onChange={(event) => onChange("postalCode", event.target.value.replace(/\D/g, "").slice(0, 5))}
        error={errors.postalCode}
        autoComplete="postal-code"
        enterKeyHint="next"
        disabled={disabled}
      />
      <TextField
        name="city"
        label="Commune"
        value={values.city}
        onChange={(event) => onChange("city", event.target.value)}
        error={errors.city}
        autoComplete="address-level2"
        enterKeyHint="next"
        disabled={disabled}
      />
    </>
  );
}
