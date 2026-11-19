import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import type { CurrentUserContext } from "@/lib/clerk";
import type { RegistrationApplication } from "@/lib/club-data";
import { TransitionRejection } from "@/lib/dossier-transitions";

/** Corps JSON de la requête, ou `undefined` s'il est absent ou invalide. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Nom inscrit dans l'historique d'un dossier. */
export function actorName(user: Pick<CurrentUserContext, "fullName" | "email">): string {
  return user.fullName?.trim() || user.email || "bureau";
}

/**
 * Transforme un refus métier (`TransitionRejection`, levé dans `updateClubData` donc sans écriture)
 * en réponse HTTP avec un message français affichable ; `null` pour toute autre erreur.
 */
export function rejectionResponse(error: unknown): NextResponse | null {
  if (error instanceof TransitionRejection) {
    return jsonError(error.message, error.status, error.code);
  }
  return null;
}

/**
 * Version d'un dossier destinée à son propriétaire : sans notes internes, historique, trace des
 * e-mails ni motif de refus. Le « message du bureau » destiné à l'adhérent (`memberMessage`) reste.
 */
export function toMemberApplicationView(application: RegistrationApplication): RegistrationApplication {
  return {
    ...application,
    notes: "",
    history: undefined,
    receiptHistory: undefined,
    lifecycleNotified: undefined,
    rejectionReason: undefined,
  };
}
