import type { ReactNode } from "react";

type ActionBarProps = {
  onBack?: () => void;
  backDisabled?: boolean;
  /** Libellé du bouton principal (validation du formulaire). */
  primaryLabel: ReactNode;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
};

/** Barre d'actions : collée en bas de l'écran sur téléphone, dans le flux à partir de la tablette. */
export default function ActionBar({ onBack, backDisabled, primaryLabel, primaryDisabled, primaryBusy }: ActionBarProps) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-brand-line bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <div className="flex items-center gap-3 sm:justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} disabled={backDisabled} className="btn btn-ghost shrink-0">
            ← Retour
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <button
          type="submit"
          disabled={primaryDisabled || primaryBusy}
          aria-busy={primaryBusy || undefined}
          className="btn btn-primary min-h-12 flex-1 sm:flex-none sm:px-10"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
