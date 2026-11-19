"use client";

import { TextField } from "@/components/forms/field-controls";
import type { BulletinValues } from "@/components/inscription/types";

type EmergencyStepProps = {
  values: BulletinValues;
  errors: Partial<Record<string, string>>;
  onChange: <K extends keyof BulletinValues>(key: K, value: BulletinValues[K]) => void;
  disabled?: boolean;
};

export default function EmergencyStep({ values, errors, onChange, disabled }: EmergencyStepProps) {
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-6 text-slate-700">
        Cette personne sera contactée par l’association en cas de problème pendant une séance (un proche, un voisin, un
        ami…).
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="emergencyContactName"
          label="Nom et prénom de cette personne"
          value={values.emergencyContactName}
          onChange={(event) => onChange("emergencyContactName", event.target.value)}
          error={errors.emergencyContactName}
          autoComplete="off"
          enterKeyHint="next"
          disabled={disabled}
        />
        <TextField
          name="emergencyContactPhone"
          label="Son numéro de téléphone"
          type="tel"
          inputMode="tel"
          value={values.emergencyContactPhone}
          onChange={(event) => onChange("emergencyContactPhone", event.target.value)}
          error={errors.emergencyContactPhone}
          autoComplete="off"
          enterKeyHint="next"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
