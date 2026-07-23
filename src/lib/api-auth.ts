import { NextResponse } from "next/server";
import {
  canAccessClubOperations,
  getCurrentUserContext,
  isPresident,
  type CurrentUserContext,
} from "@/lib/clerk";
import { isBureauRole } from "@/lib/roles";
import { jsonError } from "@/lib/api-response";

type AuthResult<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

function toErrorResponse(): NextResponse {
  return jsonError("Non autorisé.", 401);
}

export async function requireUser(): Promise<AuthResult<CurrentUserContext>> {
  const user = await getCurrentUserContext();
  if (!user) {
    return { ok: false, response: toErrorResponse() };
  }
  return { ok: true, value: user };
}

export async function requireClubOps(): Promise<AuthResult<CurrentUserContext>> {
  const result = await requireUser();
  if (!result.ok) {
    return result;
  }
  if (!canAccessClubOperations(result.value)) {
    return { ok: false, response: toErrorResponse() };
  }
  return result;
}

export async function requireCoach(): Promise<AuthResult<CurrentUserContext>> {
  const result = await requireUser();
  if (!result.ok) {
    return result;
  }
  if (result.value.role !== "coach" && !canAccessClubOperations(result.value)) {
    return { ok: false, response: toErrorResponse() };
  }
  return result;
}

/** Accès réservé au président (alias Clerk `direction` inclus). */
export async function requirePresident(): Promise<AuthResult<CurrentUserContext>> {
  const result = await requireUser();
  if (!result.ok) {
    return result;
  }
  if (!isPresident(result.value)) {
    return { ok: false, response: toErrorResponse() };
  }
  return result;
}

/** @deprecated Utiliser `requirePresident`. */
export async function requireDirection(): Promise<AuthResult<CurrentUserContext>> {
  return requirePresident();
}

export function isUserBureau(user: CurrentUserContext): boolean {
  return isBureauRole(user.role);
}
