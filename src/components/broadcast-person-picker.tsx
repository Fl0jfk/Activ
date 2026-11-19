"use client";

import { useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/bureau-ui";
import type { BroadcastRecipient } from "@/lib/broadcast-types";

type BroadcastPersonPickerProps = {
  people: BroadcastRecipient[];
  selectedEmail: string;
  onSelect: (email: string) => void;
  disabled?: boolean;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Recherche d'une personne : champ de saisie + liste de boutons (pas de faux « listbox »). */
export default function BroadcastPersonPicker({
  people,
  selectedEmail,
  onSelect,
  disabled = false,
}: BroadcastPersonPickerProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const listId = useId();

  const matches = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return people;
    return people.filter((person) =>
      normalizeSearch(`${person.name} ${person.email}`).includes(needle),
    );
  }, [people, query]);

  const selected = people.find((person) => person.email === selectedEmail) ?? null;

  if (selected) {
    return (
      <div className="rounded-2xl border-2 border-brand-green bg-brand-green/10 p-4">
        <p className="text-sm font-semibold text-slate-700">Personne choisie</p>
        <p className="mt-1 text-lg font-extrabold text-slate-900">{selected.name}</p>
        <p className="break-all text-sm text-slate-700">{selected.email}</p>
        <button
          type="button"
          onClick={() => {
            onSelect("");
            setQuery("");
          }}
          disabled={disabled}
          className="btn btn-ghost btn-sm mt-3"
        >
          Changer de personne
        </button>
      </div>
    );
  }

  if (people.length === 0) {
    return <EmptyState>Aucun adhérent n’est disponible pour le moment.</EmptyState>;
  }

  return (
    <div>
      <label htmlFor={searchId} className="field-label">
        Rechercher une personne par son nom
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        className="field text-base"
        placeholder="Tapez un nom, un prénom…"
        autoComplete="off"
        aria-controls={listId}
      />
      <p aria-live="polite" className="mt-2 text-sm text-slate-600">
        {matches.length === 0
          ? "Aucune personne trouvée."
          : `${matches.length} personne${matches.length > 1 ? "s" : ""} ${query.trim() ? "trouvée" : "disponible"}${matches.length > 1 ? "s" : ""}. Touchez un nom pour le choisir.`}
      </p>
      {matches.length > 0 ? (
        <ul
          id={listId}
          className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-300 bg-white"
        >
          {matches.map((person) => (
            <li key={person.email}>
              <button
                type="button"
                onClick={() => onSelect(person.email)}
                disabled={disabled}
                className="flex min-h-12 w-full flex-col items-start justify-center px-4 py-2.5 text-left transition hover:bg-brand-blue/5 focus-visible:bg-brand-blue/10 focus-visible:outline-none disabled:opacity-60"
              >
                <span className="text-base font-semibold text-slate-900">{person.name}</span>
                <span className="break-all text-sm text-slate-600">{person.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
