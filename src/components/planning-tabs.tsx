"use client";

import { useEffect, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

export type PlanningTabId = "semaine" | "essais" | "absences";

type PlanningTabsProps = {
  /** Onglet demandé par l'adresse (?onglet=…), lu côté serveur. */
  initialTab: PlanningTabId;
  showAbsences: boolean;
  /** Demandes d'absence à valider (affiché dans l'onglet). */
  pendingAbsences: number;
  weekPanel: ReactNode;
  trialsPanel: ReactNode;
  absencesPanel?: ReactNode;
};

const ABSENCES_HASH = "#absences-coach";

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export default function PlanningTabs({
  initialTab,
  showAbsences,
  pendingAbsences,
  weekPanel,
  trialsPanel,
  absencesPanel,
}: PlanningTabsProps) {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const [chosen, setChosen] = useState<PlanningTabId | null>(null);

  // Le lien historique « …/planning#absences-coach » ouvre l'onglet des absences.
  const requested: PlanningTabId = hash === ABSENCES_HASH && showAbsences ? "absences" : initialTab;
  const active = chosen ?? requested;

  useEffect(() => {
    if (hash === ABSENCES_HASH && active === "absences") {
      document.getElementById("absences-coach")?.scrollIntoView({ block: "start" });
    }
  }, [hash, active]);

  const tabs: { id: PlanningTabId; label: string; badge?: number }[] = [
    { id: "semaine", label: "Semaine" },
    { id: "essais", label: "Essais" },
    ...(showAbsences
      ? [{ id: "absences" as const, label: "Absences coach", badge: pendingAbsences }]
      : []),
  ];

  function select(id: PlanningTabId) {
    setChosen(id);
    const url = new URL(window.location.href);
    url.searchParams.set("onglet", id);
    url.hash = "";
    window.history.replaceState(null, "", url);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[next]!.id);
    document.getElementById(`planning-tab-${tabs[next]!.id}`)?.focus();
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Sections du planning"
        className="flex max-w-full flex-wrap gap-1 rounded-3xl border border-brand-line bg-white p-1 sm:inline-flex sm:rounded-full"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`planning-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`planning-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-bold transition ${
                selected ? "bg-brand-blue text-white shadow-sm" : "text-slate-700 hover:bg-brand-cream"
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-extrabold ${
                    selected ? "bg-white text-brand-blue-dark" : "bg-brand-orange text-slate-900"
                  }`}
                >
                  <span className="sr-only"> ({tab.badge} à valider)</span>
                  <span aria-hidden="true">{tab.badge}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="planning-panel-semaine"
        aria-labelledby="planning-tab-semaine"
        hidden={active !== "semaine"}
      >
        {weekPanel}
      </div>
      <div
        role="tabpanel"
        id="planning-panel-essais"
        aria-labelledby="planning-tab-essais"
        hidden={active !== "essais"}
      >
        {trialsPanel}
      </div>
      {showAbsences ? (
        <div
          role="tabpanel"
          id="planning-panel-absences"
          aria-labelledby="planning-tab-absences"
          hidden={active !== "absences"}
        >
          {absencesPanel}
        </div>
      ) : null}
    </div>
  );
}
