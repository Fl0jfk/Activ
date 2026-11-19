"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type PlanningModalProps = {
  open: boolean;
  title: string;
  /** Sous-titre (ex. jour et horaire de la séance). */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Couleur d'en-tête facultative (couleur de la discipline). */
  accent?: { bg: string; fg: string };
};

/** Fenêtre modale native (<dialog>) : Échap, clic à côté et bouton « Fermer » la referment. */
export default function PlanningModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  accent,
}: PlanningModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto max-h-[92vh] w-[min(560px,94vw)] overflow-y-auto rounded-3xl border-0 p-0 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)] backdrop:bg-slate-900/50"
    >
      {open ? (
        <div>
          <div
            className={`flex items-start justify-between gap-3 px-6 py-5 ${accent ? "" : "border-b border-brand-line"}`}
            style={accent ? { backgroundColor: accent.bg, color: accent.fg } : undefined}
          >
            <div className="min-w-0">
              {subtitle ? <p className="text-sm font-semibold opacity-90">{subtitle}</p> : null}
              <h2 id={titleId} className="text-2xl font-extrabold leading-tight text-balance">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre"
              className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-black/10"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
