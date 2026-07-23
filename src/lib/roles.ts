export type AppRole =
  | "member"
  | "coach"
  | "president"
  | "vice_president"
  | "treasurer"
  | "secretary";

const PRESIDENT_ROLES: ReadonlySet<AppRole> = new Set(["president"]);

const BUREAU_OFFICER_ROLES: ReadonlySet<AppRole> = new Set([
  "president",
  "vice_president",
  "treasurer",
  "secretary",
]);

const INTERNAL_ROLES: ReadonlySet<AppRole> = new Set([...BUREAU_OFFICER_ROLES, "coach"]);

const ROLE_ALIASES: Record<string, AppRole> = {
  member: "member",
  coach: "coach",
  president: "president",
  président: "president",
  vice_president: "vice_president",
  "vice-president": "vice_president",
  vicepresident: "vice_president",
  treasurer: "treasurer",
  tresorier: "treasurer",
  trésorier: "treasurer",
  secretary: "secretary",
  secretaire: "secretary",
  secrétaire: "secretary",
};

/** Normalise une valeur de rôle Clerk. */
export function normalizeAppRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ROLE_ALIASES[normalized] ?? null;
}

/** Président. */
export function isPresidentRole(role: AppRole): boolean {
  return PRESIDENT_ROLES.has(role);
}

/** Officiers bureau : président, VP, trésorier, secrétaire. */
export function isBureauOfficerRole(role: AppRole): boolean {
  return BUREAU_OFFICER_ROLES.has(role);
}

/** Bureau ou coach (accès espace interne, hors adhésion membre). */
export function isBureauRole(role: AppRole): boolean {
  return INTERNAL_ROLES.has(role);
}
