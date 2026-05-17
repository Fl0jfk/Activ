/** 1 = Lundi … 7 = Dimanche */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

const DAY_ALIASES: Record<string, DayOfWeek> = {
  lundi: 1,
  monday: 1,
  mon: 1,
  mardi: 2,
  tuesday: 2,
  tue: 2,
  mercredi: 3,
  wednesday: 3,
  wed: 3,
  jeudi: 4,
  thursday: 4,
  thu: 4,
  vendredi: 5,
  friday: 5,
  fri: 5,
  samedi: 6,
  saturday: 6,
  sat: 6,
  dimanche: 7,
  sunday: 7,
  sun: 7,
};

export function parseDayOfWeek(value: string | number | undefined): DayOfWeek {
  if (typeof value === "number" && value >= 1 && value <= 7) {
    return value as DayOfWeek;
  }
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (DAY_ALIASES[normalized]) {
    return DAY_ALIASES[normalized];
  }
  const numeric = Number.parseInt(normalized, 10);
  if (numeric >= 1 && numeric <= 7) {
    return numeric as DayOfWeek;
  }
  return 1;
}

export function dayLabelFromOfWeek(dayOfWeek: DayOfWeek): string {
  return DAY_LABELS[dayOfWeek];
}

export const DAY_OPTIONS = Object.entries(DAY_LABELS) as [string, string][];
