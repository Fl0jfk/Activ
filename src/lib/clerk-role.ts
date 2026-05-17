import type { AppRole } from "@/lib/roles";

/** Utilisateur Clerk (forme minimale pour la lecture du rôle). */
export type ClerkUserLike = {
  privateMetadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
  unsafeMetadata?: Record<string, unknown> | null;
};

const BUREAU_ROLES: AppRole[] = ["direction", "staff", "coach"];

export type RoleResolution = {
  role: AppRole;
  source: "privateMetadata" | "publicMetadata" | "unsafeMetadata" | "default";
  privateRoleRaw: unknown;
  publicRoleRaw: unknown;
  unsafeRoleRaw: unknown;
  publicFunctionsRaw: unknown;
};

function parseRoleValue(value: unknown): AppRole | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "member" || normalized === "staff" || normalized === "coach" || normalized === "direction") {
    return normalized;
  }
  return null;
}

function readRoleFromFunctionsArray(value: unknown): AppRole | null {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const item of value) {
    const parsed = parseRoleValue(item);
    if (parsed && parsed !== "member") {
      return parsed;
    }
  }
  return null;
}

function readRoleFromBag(bag: Record<string, unknown> | null | undefined): AppRole | null {
  if (!bag || typeof bag !== "object") {
    return null;
  }

  if ("role" in bag) {
    const direct = parseRoleValue(bag.role);
    if (direct) {
      return direct;
    }
  }

  // Compat : certains comptes ont mis staff/coach/direction dans functions[] au lieu de role
  const fromFunctions = readRoleFromFunctionsArray(bag.functions);
  if (fromFunctions) {
    return fromFunctions;
  }

  for (const [key, value] of Object.entries(bag)) {
    if (key.toLowerCase() === "role") {
      const parsed = parseRoleValue(value);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function pickStrongestRole(roles: Array<{ role: AppRole; source: RoleResolution["source"] }>): {
  role: AppRole;
  source: RoleResolution["source"];
} {
  if (roles.some((entry) => entry.role === "direction")) {
    return { role: "direction", source: roles.find((e) => e.role === "direction")!.source };
  }
  if (roles.some((entry) => entry.role === "staff")) {
    return { role: "staff", source: roles.find((e) => e.role === "staff")!.source };
  }
  if (roles.some((entry) => entry.role === "coach")) {
    return { role: "coach", source: roles.find((e) => e.role === "coach")!.source };
  }
  if (roles.some((entry) => entry.role === "member")) {
    return { role: "member", source: roles.find((e) => e.role === "member")!.source };
  }
  return { role: "member", source: "default" };
}

/** Lit le rôle tel que stocké dans Clerk (toutes sources metadata). */
export function readRoleFromClerkUser(user: ClerkUserLike): RoleResolution {
  const privateBag = (user.privateMetadata ?? {}) as Record<string, unknown>;
  const publicBag = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const unsafeBag = (user.unsafeMetadata ?? {}) as Record<string, unknown>;

  const privateRoleRaw = privateBag.role;
  const publicRoleRaw = publicBag.role;
  const unsafeRoleRaw = unsafeBag.role;
  const publicFunctionsRaw = publicBag.functions;

  const candidates: Array<{ role: AppRole; source: RoleResolution["source"] }> = [];

  const fromPrivate = readRoleFromBag(privateBag);
  if (fromPrivate) {
    candidates.push({ role: fromPrivate, source: "privateMetadata" });
  }

  const fromPublic = readRoleFromBag(publicBag);
  if (fromPublic) {
    candidates.push({ role: fromPublic, source: "publicMetadata" });
  }

  const fromUnsafe = readRoleFromBag(unsafeBag);
  if (fromUnsafe) {
    candidates.push({ role: fromUnsafe, source: "unsafeMetadata" });
  }

  const picked = candidates.length > 0 ? pickStrongestRole(candidates) : { role: "member" as AppRole, source: "default" as const };

  return {
    role: picked.role,
    source: picked.source,
    privateRoleRaw,
    publicRoleRaw,
    unsafeRoleRaw,
    publicFunctionsRaw,
  };
}

export function isBureauRole(role: AppRole): boolean {
  return BUREAU_ROLES.includes(role);
}
