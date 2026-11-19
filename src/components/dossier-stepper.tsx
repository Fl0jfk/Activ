import { DOSSIER_PHASES, type DossierProcessingPhase } from "@/lib/dossier-workflow";

const STEPS: DossierProcessingPhase[] = [1, 2, 3, 4, 5];

/** Les 5 étapes d’un dossier : l’étape en cours est mise en avant, les étapes passées sont cochées. */
export default function DossierStepper({ current }: { current: DossierProcessingPhase }) {
  return (
    <div>
      <p className="text-sm font-bold text-slate-900">
        Étape {current} sur 5 : <span className="text-brand-blue-dark">{DOSSIER_PHASES[current].label}</span>
      </p>
      <p className="mt-0.5 text-sm text-slate-600">{DOSSIER_PHASES[current].description}</p>
      <ol aria-label="Étapes du dossier" className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
        {STEPS.map((step) => {
          const isDone = step < current || current === 5;
          const isCurrent = step === current && current !== 5;
          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 text-center ${
                isCurrent
                  ? "border-brand-blue bg-brand-blue/10"
                  : isDone
                    ? "border-brand-green/30 bg-brand-green/10"
                    : "border-brand-line bg-slate-50"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  isCurrent
                    ? "bg-brand-blue text-white"
                    : isDone
                      ? "bg-brand-green text-white"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {isDone ? "✓" : step}
              </span>
              <span
                className={`mt-1 min-w-0 break-words text-xs leading-tight ${
                  isCurrent ? "font-bold text-brand-blue-dark" : "font-semibold text-slate-700"
                }`}
              >
                {DOSSIER_PHASES[step].shortLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
