import type { AppRole } from "@/lib/roles";
import { isBureauOfficerRole, isPresidentRole } from "@/lib/roles";

/** Utilisateur Clerk (forme minimale pour la lecture du rôle). */
export type ClerkUserLike = {
  privateMetadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
  unsafeMetadata?: Record<string, unknown> | null;
};

const ROLE_ALIASES: Record<string, AppRole> = {
  member: "member",
  coach: "coach",
  staff: "staff",
  direction: "direction",
  president: "president",
  vice_president: "vice_president",
  "vice-president": "vice_president",
  vicepresident: "vice_president",
  treasurer: "treasurer",
  tresorier: "treasurer",
  trésorier: "treasurer",
  secretary: "secretary",
  secretaire: "secretary",
  secrétaire: "secretary",
  président: "president",
};

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
  return ROLE_ALIASES[normalized] ?? null;
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

  // Compat : certains comptes ont mis le rôle dans functions[] au lieu de role
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

function roleRank(role: AppRole): number {
  if (isPresidentRole(role)) return 4;
  if (isBureauOfficerRole(role)) return 3;
  if (role === "coach") return 2;
  return 1;
}

function pickStrongestRole(roles: Array<{ role: AppRole; source: RoleResolution["source"] }>): {
  role: AppRole;
  source: RoleResolution["source"];
} {
  let best = roles[0]!;
  for (const entry of roles.slice(1)) {
    if (roleRank(entry.role) > roleRank(best.role)) {
      best = entry;
    }
  }
  return best;
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

  const picked =
    candidates.length > 0
      ? pickStrongestRole(candidates)
      : { role: "member" as AppRole, source: "default" as const };

  return {
    role: picked.role,
    source: picked.source,
    privateRoleRaw,
    publicRoleRaw,
    unsafeRoleRaw,
    publicFunctionsRaw,
  };
}

export { isBureauRole } from "@/lib/roles";
