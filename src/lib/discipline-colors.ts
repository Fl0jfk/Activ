export type DisciplineColor = {
  /** Fond plein (blocs du calendrier, pastilles). */
  bg: string;
  /** Texte lisible sur le fond plein. */
  fg: string;
  /** Fond clair pour les badges. */
  soft: string;
};

const PALETTE: DisciplineColor[] = [
  { bg: "#1f6fd0", fg: "#ffffff", soft: "#dbe9fa" },
  { bg: "#2e9e4f", fg: "#ffffff", soft: "#d7f0de" },
  { bg: "#e23d86", fg: "#ffffff", soft: "#fbdcea" },
  { bg: "#f5a524", fg: "#3a2600", soft: "#fdebc8" },
  { bg: "#0e8f8a", fg: "#ffffff", soft: "#cdeeec" },
  { bg: "#7c5cc4", fg: "#ffffff", soft: "#e6dff6" },
  { bg: "#2a9fd6", fg: "#ffffff", soft: "#d3ecf8" },
  { bg: "#8a9a1c", fg: "#ffffff", soft: "#e8edc4" },
];

/** Une couleur stable par discipline, selon sa position dans la liste enregistrée. */
export function buildDisciplineColors(disciplines: { id: string }[]): Record<string, DisciplineColor> {
  const colors: Record<string, DisciplineColor> = {};
  disciplines.forEach((discipline, index) => {
    colors[discipline.id] = PALETTE[index % PALETTE.length]!;
  });
  return colors;
}

export const FALLBACK_DISCIPLINE_COLOR: DisciplineColor = PALETTE[0]!;
