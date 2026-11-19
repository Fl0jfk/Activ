import { STEP_INFO } from "@/components/inscription/steps-config";
import type { StepId } from "@/components/inscription/types";

type StepProgressProps = {
  steps: readonly StepId[];
  current: number;
  disabled?: boolean;
  onGoTo: (index: number) => void;
};

export default function StepProgress({ steps, current, disabled = false, onGoTo }: StepProgressProps) {
  const total = steps.length;
  const info = STEP_INFO[steps[current]!];
  return (
    <nav aria-label="Progression de l’inscription" className="mb-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-extrabold text-brand-blue-dark">
          Étape {current + 1} sur {total}
        </p>
        <p className="text-sm font-semibold text-slate-700">{info.label}</p>
      </div>
      <div
        role="progressbar"
        aria-label="Avancement de l’inscription"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-valuetext={`Étape ${current + 1} sur ${total} : ${info.label}`}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-blue/15"
      >
        <div
          className="h-full rounded-full bg-brand-blue transition-[width] duration-300"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
      <ol className="mt-3 hidden flex-wrap gap-x-5 gap-y-1 text-sm md:flex">
        {steps.map((step, index) => {
          const label = STEP_INFO[step].label;
          if (index < current) {
            return (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => onGoTo(index)}
                  disabled={disabled}
                  className="min-h-11 font-semibold text-brand-green-dark hover:underline"
                >
                  <span aria-hidden>✓ </span>
                  {label}
                  <span className="sr-only"> (revenir à cette étape)</span>
                </button>
              </li>
            );
          }
          return (
            <li
              key={step}
              aria-current={index === current ? "step" : undefined}
              className={`flex min-h-11 items-center ${index === current ? "font-extrabold text-slate-900" : "text-slate-600"}`}
            >
              {label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
