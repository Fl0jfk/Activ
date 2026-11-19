import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export type ApiErrorBody = {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

const NO_STORE = { "Cache-Control": "no-store" };

export function apiError(
  message: string,
  status: number,
  extra?: { code?: string; fieldErrors?: Record<string, string> },
): NextResponse {
  const body: ApiErrorBody = { message };
  if (extra?.code) body.code = extra.code;
  if (extra?.fieldErrors && Object.keys(extra.fieldErrors).length > 0) {
    body.fieldErrors = extra.fieldErrors;
  }
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function apiOk(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function formatWait(seconds: number): string {
  if (seconds <= 90) return `${Math.max(1, Math.ceil(seconds))} secondes`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 120) return `${minutes} minutes`;
  return `${Math.ceil(minutes / 60)} heures`;
}

export function rateLimitedResponse(
  retryAfterSeconds: number,
  message = `Trop de tentatives. Réessayez dans ${formatWait(retryAfterSeconds)}.`,
): NextResponse {
  const wait = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    { message, retryAfterSeconds: wait, code: "rate_limited" },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(wait) } },
  );
}

export function requestIp(request: Request): string {
  return clientIpFromRequest(request);
}

/**
 * Limite par adresse IP. Quand aucune adresse n'est transmise par le serveur frontal
 * (« unknown »), tous les visiteurs partagent la même clé : le plafond est alors relevé
 * pour ne pas bloquer tout le monde.
 */
export function limitByIp(
  request: Request,
  name: string,
  options: { limit: number; windowMs: number },
): NextResponse | null {
  const ip = requestIp(request);
  const limit = ip === "unknown" ? options.limit * 10 : options.limit;
  const result = checkRateLimit(`${name}:ip:${ip}`, { limit, windowMs: options.windowMs });
  return result.allowed ? null : rateLimitedResponse(result.retryAfterSeconds);
}

/** Limite par clé libre (adresse e-mail normalisée, identifiant d'utilisateur…). */
export function limitByKey(
  name: string,
  key: string,
  options: { limit: number; windowMs: number },
  message?: string,
): NextResponse | null {
  const result = checkRateLimit(`${name}:key:${key}`, options);
  return result.allowed ? null : rateLimitedResponse(result.retryAfterSeconds, message);
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/** Lit un corps JSON de taille limitée ; refuse tout ce qui n'est pas un objet. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: apiError("Requête trop volumineuse.", 413) };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: apiError("Corps de requête invalide.", 400) };
  }
  if (text.length > maxBytes) {
    return { ok: false, response: apiError("Requête trop volumineuse.", 413) };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, response: apiError("Corps de requête invalide.", 400) };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: apiError("Corps de requête invalide.", 400) };
  }
}

/** Refuse tôt un envoi de fichier trop gros, avant de le charger en mémoire. */
export function rejectOversizedUpload(request: Request, maxBytes: number): NextResponse | null {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return apiError("Fichier trop volumineux (5 Mo maximum).", 413);
  }
  return null;
}

export function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}
