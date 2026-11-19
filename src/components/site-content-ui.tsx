"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Badge, StatusMessage, type Feedback } from "@/components/bureau-ui";

type CollapsibleProps = {
  title: string;
  description?: string;
  /** Pastille affichée à droite du titre (nombre d’éléments, alerte…). */
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** Mode contrôlé : si `open` est fourni, c’est le parent qui décide. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

/** Bloc repliable avec grand bouton « Ouvrir / Replier » (pour les options avancées). */
export function Collapsible({
  title,
  description,
  badge,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className = "",
}: CollapsibleProps) {
  const panelId = useId();
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = open ?? innerOpen;

  function toggle() {
    const next = !isOpen;
    setInnerOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={`rounded-2xl border border-brand-line bg-white ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-brand-cream/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
      >
        <span className="min-w-0">
          <span className="block text-base font-bold text-slate-900">{title}</span>
          {description ? <span className="mt-0.5 block text-sm text-slate-600">{description}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {badge}
          <span className="flex items-center gap-1 text-sm font-semibold text-brand-blue">
            {isOpen ? "Replier" : "Ouvrir"}
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </span>
        </span>
      </button>
      {isOpen ? (
        <div id={panelId} className="border-t border-brand-line px-4 pb-4 pt-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type SaveBarProps = {
  dirty: boolean;
  saving: boolean;
  primaryLabel: string;
  savingLabel?: string;
  /** Sans `onPrimary`, le bouton principal envoie le formulaire (type="submit"). */
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Message de succès ou d’erreur, affiché juste à côté du bouton. */
  feedback: Feedback;
  /** Masque l’indicateur « modifications non enregistrées ». */
  hideDirtyHint?: boolean;
  sticky?: boolean;
};

/** Barre d’actions : bouton principal, bouton secondaire, état des modifications et message. */
export function SaveBar({
  dirty,
  saving,
  primaryLabel,
  savingLabel = "Enregistrement…",
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  feedback,
  hideDirtyHint = false,
  sticky = true,
}: SaveBarProps) {
  return (
    <div
      className={`${sticky ? "sticky bottom-3 z-20" : ""} rounded-2xl border border-brand-line bg-white/95 p-3 shadow-[0_12px_30px_-12px_rgba(20,64,127,0.4)] backdrop-blur`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type={onPrimary ? "button" : "submit"}
          onClick={onPrimary}
          disabled={saving || primaryDisabled}
          className="btn btn-primary"
        >
          {saving ? savingLabel : primaryLabel}
        </button>
        {secondaryLabel ? (
          <button type="button" onClick={onSecondary} disabled={saving} className="btn btn-ghost">
            {secondaryLabel}
          </button>
        ) : null}
        {hideDirtyHint ? null : dirty ? (
          <Badge tone="orange">Modifications non enregistrées</Badge>
        ) : (
          <span className="text-sm text-slate-600">Aucune modification en attente</span>
        )}
      </div>
      {feedback ? <StatusMessage feedback={feedback} className="mt-3" /> : null}
    </div>
  );
}

/** Lien qui s’ouvre dans un nouvel onglet (voir une page du site publié). */
export function NewTabLink({
  href,
  children,
  className = "btn btn-ghost btn-sm",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
    </Link>
  );
}
