import { createHash, timingSafeEqual } from "crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Comparaison de jetons en temps constant. */
export function tokensEqual(expected: string, provided: string): boolean {
  return timingSafeEqual(digest(expected), digest(provided));
}

/** Retrouve l'entrée dont le jeton correspond, sans court-circuiter selon le contenu du jeton. */
export function findByToken<T extends { token: string }>(entries: T[], token: string): T | null {
  let found: T | null = null;
  for (const entry of entries) {
    if (typeof entry.token === "string" && tokensEqual(entry.token, token) && !found) {
      found = entry;
    }
  }
  return found;
}

/** Jeton plausible (évite de traiter des valeurs absurdes ou gigantesques). */
export function isPlausibleToken(token: string): boolean {
  return token.length >= 16 && token.length <= 200 && /^[A-Za-z0-9._~-]+$/.test(token);
}
