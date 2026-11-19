export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** Message du serveur (champ `message`), ou message d'erreur réseau lisible. */
  message: string;
};

/**
 * fetch + JSON sans exception : gère l'absence de réseau et les réponses non JSON.
 * À utiliser à la place de fetch(...).then(r => r.json()) dans les panneaux du bureau.
 */
export async function fetchJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(input, init);
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      data = null;
    }
    const message =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : "";
    return { ok: response.ok, status: response.status, data, message };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      message: "Connexion impossible. Vérifiez votre réseau puis réessayez.",
    };
  }
}

export function jsonInit(method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
