import type { AssociationData } from "@/lib/site-data-types";

export type DisciplineOption = {
  id: string;
  name: string;
  slug: string;
};

export function getActiveDisciplineOptions(siteData: AssociationData): DisciplineOption[] {
  return siteData.disciplines
    .filter((discipline) => discipline.active)
    .map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      slug: discipline.slug,
    }));
}
