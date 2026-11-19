"use client";

import { useSyncExternalStore } from "react";
import { todayLocalIso } from "@/components/forms/validators";

const subscribeNever = () => () => {};

/** Date du jour du navigateur (AAAA-MM-JJ). Vide pendant le rendu serveur : pas de décalage à l'hydratation. */
export function useTodayIso(): string {
  return useSyncExternalStore(subscribeNever, todayLocalIso, () => "");
}
