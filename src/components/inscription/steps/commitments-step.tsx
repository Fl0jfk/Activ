"use client";

import type { ReactNode } from "react";
import ChoiceCard from "@/components/forms/choice-card";
import type { BulletinValues } from "@/components/inscription/types";
import type { MembershipImageRights } from "@/lib/membership-bulletin";

type CommitmentKey = "acceptRules" | "acceptHealth" | "acceptInsurance" | "acceptRefund";

type CommitmentsStepProps = {
  values: BulletinValues;
  errors: Partial<Record<string, string>>;
  onChange: <K extends keyof BulletinValues>(key: K, value: BulletinValues[K]) => void;
};

function CommitmentCheckbox({
  name,
  checked,
  error,
  onChange,
  children,
}: {
  name: CommitmentKey;
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const id = `field-${name}`;
  return (
    <div>
      <ChoiceCard
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : undefined}
      >
        {children}
      </ChoiceCard>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function CommitmentsStep({ values, errors, onChange }: CommitmentsStepProps) {
  const imageError = errors.imageRights;
  const setImageRights = (value: MembershipImageRights) => onChange("imageRights", value);

  return (
    <div id="field-commitments" tabIndex={-1} className="scroll-mt-24 space-y-4 focus:outline-none">
      <p className="text-[15px] leading-6 text-slate-700">
        Lisez chaque engagement et cochez la case pour confirmer que vous êtes d’accord. Toutes les cases sont nécessaires
        pour valider votre adhésion.
      </p>
      {errors.commitments ? <p className="text-sm font-semibold text-rose-700">{errors.commitments}</p> : null}

      <CommitmentCheckbox
        name="acceptRules"
        checked={values.acceptRules}
        error={errors.acceptRules}
        onChange={(checked) => onChange("acceptRules", checked)}
      >
        <strong>Règlement intérieur :</strong> je m’engage à respecter le règlement intérieur de l’association ainsi que
        les consignes de sécurité des locaux mis à disposition par la mairie de Sainte-Croix.
      </CommitmentCheckbox>

      <CommitmentCheckbox
        name="acceptHealth"
        checked={values.acceptHealth}
        error={errors.acceptHealth}
        onChange={(checked) => onChange("acceptHealth", checked)}
      >
        <strong>Santé :</strong> je certifie être en condition physique suffisante pour pratiquer les activités cochées,
        sous ma propre responsabilité, et signaler toute situation particulière à l’intervenant.
      </CommitmentCheckbox>

      <CommitmentCheckbox
        name="acceptInsurance"
        checked={values.acceptInsurance}
        error={errors.acceptInsurance}
        onChange={(checked) => onChange("acceptInsurance", checked)}
      >
        <strong>Assurance :</strong> j’ai été informé de l’intérêt à souscrire une assurance individuelle accidents
        corporels. L’association ne fournit pas cette garantie.
      </CommitmentCheckbox>

      <fieldset
        id="field-imageRights"
        tabIndex={-1}
        aria-describedby={imageError ? "field-imageRights-error" : undefined}
        className="min-w-0 scroll-mt-24 space-y-3 rounded-2xl border border-brand-line p-4 focus:outline-none"
      >
        <legend className="px-1 text-base font-extrabold text-slate-900">Droit à l’image</legend>
        <ChoiceCard
          type="radio"
          name="imageRights"
          value="authorize"
          checked={values.imageRights === "authorize"}
          onChange={() => setImageRights("authorize")}
          invalid={Boolean(imageError)}
        >
          J’autorise l’association à utiliser mon image pour ses supports et Facebook.
        </ChoiceCard>
        <ChoiceCard
          type="radio"
          name="imageRights"
          value="refuse"
          checked={values.imageRights === "refuse"}
          onChange={() => setImageRights("refuse")}
          invalid={Boolean(imageError)}
        >
          Je n’autorise pas l’utilisation de mon image.
        </ChoiceCard>
        {imageError ? (
          <p id="field-imageRights-error" className="text-sm font-semibold text-rose-700">
            {imageError}
          </p>
        ) : null}
      </fieldset>

      <CommitmentCheckbox
        name="acceptRefund"
        checked={values.acceptRefund}
        error={errors.acceptRefund}
        onChange={(checked) => onChange("acceptRefund", checked)}
      >
        <strong>Remboursement :</strong> je reconnais que les cotisations sont non remboursables sauf cas de force
        majeure justifié, étudié au cas par cas par le bureau.
      </CommitmentCheckbox>
    </div>
  );
}
