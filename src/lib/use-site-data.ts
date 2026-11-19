import { useCallback, useEffect, useState } from "react";
import { fetchJson, jsonInit, type ApiResult } from "@/lib/fetch-json";
import type { AssociationData } from "@/lib/site-data-types";

/** Sections que chaque onglet du bureau peut enregistrer (uniquement celles qu’il modifie). */
export type SiteSections = Partial<
  Pick<AssociationData, "association" | "disciplines" | "schedule" | "news" | "polls" | "homeGallery">
>;

export type SaveSectionsResult =
  | { ok: true; saved: SiteSections; message: string }
  | { ok: false; message: string };

const SITE_DATA_URL = "/api/admin/site-data";
const SAVE_ERROR = "Enregistrement impossible. Réessayez dans un instant.";

export function loadFreshSiteData(): Promise<ApiResult<AssociationData>> {
  return fetchJson<AssociationData>(SITE_DATA_URL, { cache: "no-store" });
}

/** Envoie uniquement les sections données ; le serveur les fusionne sur ses données les plus récentes. */
export async function saveSiteSections(sections: SiteSections): Promise<SaveSectionsResult> {
  const result = await fetchJson<{ message?: string; saved?: SiteSections }>(
    SITE_DATA_URL,
    jsonInit("PUT", sections),
  );
  if (!result.ok) {
    return { ok: false, message: result.message || SAVE_ERROR };
  }
  return {
    ok: true,
    saved: result.data?.saved ?? sections,
    message: result.message || "Données enregistrées.",
  };
}

/**
 * Relit les données juste avant de modifier une liste (actualités, photos…), puis n’enregistre que
 * les sections renvoyées. `compute` peut renvoyer un texte pour refuser l’opération.
 */
export async function saveFromFreshData(
  compute: (fresh: AssociationData) => SiteSections | string,
): Promise<SaveSectionsResult> {
  const fresh = await loadFreshSiteData();
  if (!fresh.ok || !fresh.data) {
    return {
      ok: false,
      message: fresh.message || "Impossible de vérifier les données du site. Réessayez dans un instant.",
    };
  }
  const sections = compute(fresh.data);
  if (typeof sections === "string") {
    return { ok: false, message: sections };
  }
  return saveSiteSections(sections);
}

/** Chargement unique des données du site pour tous les onglets du bureau. */
export function useSiteData() {
  const [data, setData] = useState<AssociationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const applyResult = useCallback((result: ApiResult<AssociationData>) => {
    if (result.ok && result.data) {
      setData(result.data);
      setError("");
      setForbidden(false);
    } else {
      setError(result.message || "Impossible de charger les données du site.");
      setForbidden(result.status === 401 || result.status === 403);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadFreshSiteData().then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    applyResult(await loadFreshSiteData());
  }, [applyResult]);
  /** Met à jour la copie locale après un enregistrement réussi. */
  const applySaved = useCallback((saved: SiteSections) => {
    setData((previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...saved };
      if (saved.disciplines) {
        // Le serveur applique la même règle : une discipline supprimée libère ses actualités.
        const ids = new Set(saved.disciplines.map((discipline) => discipline.id));
        next.news = next.news.map((item) =>
          item.disciplineId && !ids.has(item.disciplineId) ? { ...item, disciplineId: null } : item,
        );
      }
      if (saved.schedule) {
        const slotIds = new Set(saved.schedule.map((slot) => slot.id));
        next.scheduleExceptions = next.scheduleExceptions.filter((exception) => slotIds.has(exception.scheduleSlotId));
      }
      return next;
    });
  }, []);

  return { data, loading, error, forbidden, reload, applySaved };
}
