"use client";

import type { Ref } from "react";
import { fieldId } from "@/components/forms/field-controls";

export type FieldErrors = Partial<Record<string, string>>;

/** Met le focus sur le champ `field-<clé>` (ou renvoie false s'il n'existe pas). */
export function focusField(key: string): boolean {
  const element = document.getElementById(fieldId(key));
  if (!element) return false;
  element.focus();
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}

/** Donne le focus à la première erreur, dans l'ordre d'affichage du formulaire. */
export function focusFirstError(errors: FieldErrors, order: readonly string[]): boolean {
  const keys = [...order.filter((key) => errors[key]), ...Object.keys(errors).filter((key) => !order.includes(key))];
  return keys.some((key) => focusField(key));
}

type ErrorSummaryProps = {
  errors: FieldErrors;
  /** Ordre et libellés des champs, pour la liste cliquable. */
  labels: Record<string, string>;
  order: readonly string[];
  /** Message général (erreur réseau, serveur…) sans champ précis. */
  message?: string;
  summaryRef?: Ref<HTMLDivElement>;
};

/** Résumé placé en haut du formulaire : annoncé par les lecteurs d'écran, liens vers chaque champ. */
export default function ErrorSummary({ errors, labels, order, message, summaryRef }: ErrorSummaryProps) {
  const keys = [...order.filter((key) => errors[key]), ...Object.keys(errors).filter((key) => !order.includes(key))].filter(
    (key) => errors[key],
  );
  if (keys.length === 0 && !message) return null;

  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      className="mb-5 rounded-2xl bg-rose-50 p-4 text-rose-900 ring-1 ring-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
    >
      {message ? <p className="text-[15px] font-semibold">{message}</p> : null}
      {keys.length > 0 ? (
        <>
          <p className="text-[15px] font-bold">
            {keys.length === 1 ? "Un champ est à corriger :" : `${keys.length} champs sont à corriger :`}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {keys.map((key) => (
              <li key={key}>
                <a
                  href={`#${fieldId(key)}`}
                  onClick={(event) => {
                    if (focusField(key)) event.preventDefault();
                  }}
                  className="font-semibold underline underline-offset-2"
                >
                  {labels[key] ?? key}
                </a>
                <span> : {errors[key]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
