import type { RegistrationApplication } from "@/lib/club-data";

/** Date lisible (« 12 nov. 2026 ») à partir d’une date ISO complète ou d’un jour (AAAA-MM-JJ). */
export function formatDateFr(value: string | null | undefined, style: "short" | "long" = "short"): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  });
}

export function formatEuro(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

/** Minuscules sans accents, pour une recherche tolérante. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesDossierSearch(application: RegistrationApplication, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const haystack = normalizeSearch(
    [application.fullName, application.firstName, application.lastName, application.email, application.phone]
      .filter(Boolean)
      .join(" "),
  );
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export type DossierSort = "recent" | "oldest" | "name";

export const DOSSIER_SORT_LABELS: Record<DossierSort, string> = {
  recent: "Les plus récents d’abord",
  oldest: "Les plus anciens d’abord",
  name: "Nom (A → Z)",
};

export function sortDossiers(
  applications: RegistrationApplication[],
  sort: DossierSort,
): RegistrationApplication[] {
  const copy = [...applications];
  if (sort === "name") {
    return copy.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr", { sensitivity: "base" }));
  }
  const direction = sort === "oldest" ? 1 : -1;
  return copy.sort((a, b) => direction * a.createdAt.localeCompare(b.createdAt));
}
