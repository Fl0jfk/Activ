"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Message de retour affiché près de l'action (succès, erreur ou information). */
export type Feedback = { tone: "success" | "error" | "info"; text: string } | null;

export function StatusMessage({ feedback, className = "" }: { feedback: Feedback; className?: string }) {
  if (!feedback) return null;
  const tones = {
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    info: "bg-brand-blue/10 text-brand-blue-dark ring-brand-blue/20",
  } as const;
  return (
    <p
      role={feedback.tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${tones[feedback.tone]} ${className}`}
    >
      {feedback.text}
    </p>
  );
}

type BadgeTone = "blue" | "green" | "orange" | "rose" | "violet" | "slate";

const BADGE_TONES: Record<BadgeTone, string> = {
  blue: "bg-brand-blue/12 text-brand-blue-dark",
  green: "bg-brand-green/15 text-brand-green-dark",
  orange: "bg-amber-100 text-amber-900",
  rose: "bg-rose-100 text-rose-800",
  violet: "bg-violet-100 text-violet-800",
  slate: "bg-slate-100 text-slate-700",
};

export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SectionCard({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`anchor-section panel min-w-0 p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-brand-cream/60 px-4 py-6 text-center text-sm text-slate-600">
      {children}
    </p>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** « danger » colore le bouton de confirmation en rouge (suppression, désinscription…). */
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/** Remplace window.confirm : fenêtre claire, cliquable au doigt, avec texte explicite. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onCancel();
      }}
      className="m-auto w-[min(460px,94vw)] rounded-3xl border-0 p-0 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)] backdrop:bg-slate-900/50"
    >
      <div className="p-6">
        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
        {message ? <div className="mt-2 text-[15px] leading-6 text-slate-700">{message}</div> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost btn-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`btn btn-sm ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
          >
            {busy ? "Un instant…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
