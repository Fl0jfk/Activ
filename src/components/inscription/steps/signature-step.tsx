"use client";

import { TextField } from "@/components/forms/field-controls";
import SignaturePad, { type SignatureValue } from "@/components/signature-pad";
import type { BulletinValues } from "@/components/inscription/types";

type SignatureStepProps = {
  values: BulletinValues;
  errors: Partial<Record<string, string>>;
  onChange: <K extends keyof BulletinValues>(key: K, value: BulletinValues[K]) => void;
  signature: SignatureValue | null;
  onSignatureChange: (value: SignatureValue | null) => void;
  todayIso: string;
  disabled?: boolean;
};

export default function SignatureStep({
  values,
  errors,
  onChange,
  signature,
  onSignatureChange,
  todayIso,
  disabled,
}: SignatureStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-6 text-slate-700">
        Je certifie avoir pris connaissance de l’ensemble des informations et déclarations du bulletin.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="signedPlace"
          label="Fait à"
          value={values.signedPlace}
          onChange={(event) => onChange("signedPlace", event.target.value)}
          error={errors.signedPlace}
          autoComplete="off"
          disabled={disabled}
        />
        <TextField
          name="signedAt"
          label="Le"
          type="date"
          value={values.signedAt}
          max={todayIso || undefined}
          onChange={(event) => onChange("signedAt", event.target.value)}
          error={errors.signedAt}
          disabled={disabled}
        />
      </div>
      <div id="field-signature" tabIndex={-1} className="scroll-mt-24 scroll-mb-32 focus:outline-none">
        <p id="signature-label" className="field-label mb-2">
          Signature de l’adhérent(e)
        </p>
        <SignaturePad
          value={signature}
          onChange={onSignatureChange}
          disabled={disabled}
          invalid={Boolean(errors.signature)}
          describedBy={errors.signature ? "field-signature-error" : undefined}
        />
        {errors.signature ? (
          <p id="field-signature-error" className="mt-2 text-sm font-semibold text-rose-700">
            {errors.signature}
          </p>
        ) : null}
      </div>
    </div>
  );
}
