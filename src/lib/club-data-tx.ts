import { updateClubData, type ClubData } from "@/lib/club-data";

class AbortWrite extends Error {
  constructor(readonly result: unknown) {
    super("club-data update aborted");
  }
}

/** À appeler dans un `runClubTransaction` pour annuler l'écriture et renvoyer `result` à l'appelant. */
export function abortWrite(result: unknown): never {
  throw new AbortWrite(result);
}

/**
 * Comme `updateClubData`, mais `abortWrite(result)` annule l'écriture sans erreur :
 * pratique pour refuser une opération (doublon, jeton déjà utilisé…) sans réécrire le fichier.
 */
export async function runClubTransaction<T>(
  mutator: (data: ClubData) => Promise<T> | T,
): Promise<T> {
  try {
    return await updateClubData(mutator);
  } catch (error) {
    if (error instanceof AbortWrite) return error.result as T;
    throw error;
  }
}
