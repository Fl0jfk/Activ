"use client";

import ChoiceCard from "@/components/forms/choice-card";
import { ASSOCIATION_PAYEE } from "@/components/inscription/steps-config";
import { formatEuros } from "@/components/inscription/format";
import type { MembershipActivityOption } from "@/lib/membership-activities";
import {
  MEMBERSHIP_ADHESION_FEE,
  activitiesFeeForCount,
  computeMembershipTotals,
  paymentPlanLabel,
  type MembershipPaymentPlan,
} from "@/lib/membership-bulletin";

type ActivitiesStepProps = {
  options: MembershipActivityOption[];
  selectedSlots: string[];
  paymentPlan: MembershipPaymentPlan;
  errors: Partial<Record<string, string>>;
  onToggleSlot: (slotId: string) => void;
  onPaymentPlanChange: (plan: MembershipPaymentPlan) => void;
};

export default function ActivitiesStep({
  options,
  selectedSlots,
  paymentPlan,
  errors,
  onToggleSlot,
  onPaymentPlanChange,
}: ActivitiesStepProps) {
  const totals = computeMembershipTotals(selectedSlots);
  const slotsError = errors.selectedSlots;

  return (
    <div className="space-y-8">
      <fieldset
        id="field-selectedSlots"
        tabIndex={-1}
        aria-describedby={slotsError ? "field-selectedSlots-error" : undefined}
        className="min-w-0 scroll-mt-24 scroll-mb-32 focus:outline-none"
      >
        <legend className="text-lg font-extrabold text-slate-900">Choisissez vos activités</legend>
        <p className="mt-1 text-[15px] leading-6 text-slate-700">
          Cochez un ou plusieurs cours. L’adhésion à l’association ({formatEuros(MEMBERSHIP_ADHESION_FEE)}) est obligatoire
          et s’ajoute au tarif des activités.
        </p>

        {options.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-950">
            Aucune activité n’est encore ouverte aux inscriptions. Contactez le bureau de l’association.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {options.map((slot) => (
              <ChoiceCard
                key={slot.id}
                type="checkbox"
                name="selectedSlots"
                value={slot.id}
                checked={selectedSlots.includes(slot.id)}
                onChange={() => onToggleSlot(slot.id)}
                invalid={Boolean(slotsError)}
              >
                <span className="block font-bold text-slate-900">
                  {slot.day} {slot.time}
                </span>
                <span className="block text-slate-700">{slot.activity}</span>
              </ChoiceCard>
            ))}
          </div>
        )}
        {slotsError ? (
          <p id="field-selectedSlots-error" className="mt-2 text-sm font-semibold text-rose-700">
            {slotsError}
          </p>
        ) : null}
      </fieldset>

      <section aria-label="Tarifs" className="rounded-2xl bg-brand-blue/5 p-4 ring-1 ring-brand-blue/15">
        <p className="text-sm text-slate-700">
          Tarif des activités : 1 activité {formatEuros(activitiesFeeForCount(1))} · 2 activités{" "}
          {formatEuros(activitiesFeeForCount(2))} · 3 activités ou plus {formatEuros(activitiesFeeForCount(3))}.
        </p>
        <p aria-live="polite" className="mt-2 text-lg font-extrabold text-brand-blue-dark">
          {selectedSlots.length > 0 ? (
            <>
              Total à régler : {formatEuros(totals.grandTotal)}
              <span className="block text-sm font-semibold text-slate-700">
                Adhésion {formatEuros(MEMBERSHIP_ADHESION_FEE)} + activités {formatEuros(totals.activitiesTotal)}
              </span>
            </>
          ) : (
            "Total à régler : choisissez au moins une activité"
          )}
        </p>
      </section>

      <fieldset className="min-w-0">
        <legend className="text-lg font-extrabold text-slate-900">Comment souhaitez-vous payer ?</legend>
        <p className="mt-1 text-[15px] leading-6 text-slate-700">
          Le paiement se fait auprès du bureau, pas en ligne. Vous pourrez changer ce choix avant l’envoi.
        </p>
        <div className="mt-4 space-y-3">
          <ChoiceCard
            type="radio"
            name="paymentPlan"
            value="once"
            checked={paymentPlan === "once"}
            onChange={() => onPaymentPlanChange("once")}
          >
            <span className="block font-bold text-slate-900">{paymentPlanLabel("once")}</span>
            <span className="block text-slate-700">Chèque à l’ordre de « {ASSOCIATION_PAYEE} ».</span>
          </ChoiceCard>
          <ChoiceCard
            type="radio"
            name="paymentPlan"
            value="three_times"
            checked={paymentPlan === "three_times"}
            onChange={() => onPaymentPlanChange("three_times")}
          >
            <span className="block font-bold text-slate-900">{paymentPlanLabel("three_times")}</span>
          </ChoiceCard>
        </div>
      </fieldset>
    </div>
  );
}
