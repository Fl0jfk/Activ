export type AppRole = "member" | "staff" | "coach" | "direction";

export function isBureauRole(role: AppRole): boolean {
  return role === "direction" || role === "staff" || role === "coach";
}
