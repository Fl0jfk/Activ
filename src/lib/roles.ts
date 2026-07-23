export type AppRole =
  | "member"
  | "coach"
  | "staff"
  | "direction"
  | "president"
  | "vice_president"
  | "treasurer"
  | "secretary";

const PRESIDENT_ROLES: ReadonlySet<AppRole> = new Set(["president", "direction"]);

const BUREAU_OFFICER_ROLES: ReadonlySet<AppRole> = new Set([
  "president",
  "direction",
  "vice_president",
  "treasurer",
  "secretary",
  "staff",
]);

const INTERNAL_ROLES: ReadonlySet<AppRole> = new Set([
  ...BUREAU_OFFICER_ROLES,
  "coach",
]);

/** Président (ou ancien alias `direction`). */
export function isPresidentRole(role: AppRole): boolean {
  return PRESIDENT_ROLES.has(role);
}

/** Officiers bureau : président + VP / trésorier / secrétaire (+ alias `staff` / `direction`). */
export function isBureauOfficerRole(role: AppRole): boolean {
  return BUREAU_OFFICER_ROLES.has(role);
}

/** Bureau ou coach (accès espace interne, hors adhésion membre). */
export function isBureauRole(role: AppRole): boolean {
  return INTERNAL_ROLES.has(role);
}
