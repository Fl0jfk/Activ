function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Identifiant court et imprévisible (utilisable aussi côté navigateur). */
export function randomId(prefix: string): string {
  return `${prefix}-${randomHex(5)}`;
}

/** Jeton secret pour les liens envoyés par e-mail (256 bits par défaut). */
export function secureToken(byteCount = 32): string {
  return randomHex(byteCount);
}
