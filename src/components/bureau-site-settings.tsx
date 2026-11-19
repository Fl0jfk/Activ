"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import HomeGalleryPanel from "@/components/home-gallery-panel";
import SiteNewsPanel from "@/components/site-news-panel";
import { StatusMessage } from "@/components/bureau-ui";
import { DisciplinesSettingsSection } from "@/components/site-disciplines-section";
import { AssociationSettingsSection } from "@/components/site-settings-form";
import { useSiteData } from "@/lib/use-site-data";

const TABS = [
  { id: "actualites", label: "Actualités", hint: "Nouvelles et sondages" },
  { id: "photos", label: "Photos de l’accueil", hint: "Photos et mosaïque" },
  { id: "association", label: "L’association", hint: "Coordonnées et bureau" },
  { id: "disciplines", label: "Disciplines et horaires", hint: "Activités et créneaux" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(value: string | null): TabId {
  return TABS.find((tab) => tab.id === value)?.id ?? "actualites";
}

/** Page « Contenu du site » : un onglet par type de contenu, un seul visible à la fois. */
export default function BureauContentTabs() {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<TabId>(() => parseTab(searchParams.get("onglet")));
  const [visited, setVisited] = useState<TabId[]>(() => [parseTab(searchParams.get("onglet"))]);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { data, loading, error, forbidden, reload, applySaved } = useSiteData();

  function selectTab(id: TabId, focus = false) {
    setActive(id);
    setVisited((previous) => (previous.includes(id) ? previous : [...previous, id]));
    window.history.replaceState(null, "", `${window.location.pathname}?onglet=${id}`);
    if (focus) tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target = -1;
    if (event.key === "ArrowRight") target = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = TABS.length - 1;
    if (target < 0) return;
    event.preventDefault();
    selectTab(TABS[target].id, true);
  }

  function renderPanel(id: TabId) {
    if (!data) return null;
    switch (id) {
      case "actualites":
        return <SiteNewsPanel data={data} onSaved={applySaved} />;
      case "photos":
        return <HomeGalleryPanel data={data} onSaved={applySaved} />;
      case "association":
        return <AssociationSettingsSection data={data} onSaved={applySaved} />;
      case "disciplines":
        return <DisciplinesSettingsSection data={data} onSaved={applySaved} />;
    }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Sections du contenu du site" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[tab.id] = element;
              }}
              type="button"
              role="tab"
              id={`onglet-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panneau-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`min-h-[4.25rem] rounded-2xl border-2 px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                selected
                  ? "border-brand-blue bg-brand-blue text-white shadow-[0_8px_20px_-10px_rgba(31,111,208,0.8)]"
                  : "border-brand-line bg-white text-slate-800 hover:border-brand-blue/50"
              }`}
            >
              <span className="block text-base font-extrabold leading-tight">{tab.label}</span>
              <span className={`mt-0.5 block text-sm ${selected ? "text-white/90" : "text-slate-600"}`}>{tab.hint}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p role="status" className="panel p-6 text-sm text-slate-700">
          Chargement du contenu du site…
        </p>
      ) : !data ? (
        <div className="panel space-y-4 p-6">
          <StatusMessage
            feedback={{
              tone: "error",
              text: forbidden
                ? "Cette page est réservée au président de l’association."
                : error || "Impossible de charger le contenu du site.",
            }}
          />
          {forbidden ? null : (
            <button type="button" onClick={() => void reload()} className="btn btn-primary">
              Réessayer
            </button>
          )}
        </div>
      ) : (
        TABS.map((tab) =>
          visited.includes(tab.id) ? (
            <div
              key={tab.id}
              role="tabpanel"
              id={`panneau-${tab.id}`}
              aria-labelledby={`onglet-${tab.id}`}
              hidden={tab.id !== active}
            >
              {renderPanel(tab.id)}
            </div>
          ) : null,
        )
      )}
    </div>
  );
}
