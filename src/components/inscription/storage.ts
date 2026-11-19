"use client";

import { useSyncExternalStore } from "react";
import type { MembershipPaymentPlan } from "@/lib/membership-bulletin";

/**
 * Stockage navigateur de la pré-inscription.
 * - brouillon (localStorage) : champs saisis, jamais le mot de passe, la signature ni le code reçu par e-mail ;
 * - vérification e-mail (sessionStorage) : identifiant renvoyé par le serveur, valable le temps de l'onglet ;
 * - « terminé » (sessionStorage) : prénom, e-mail et paiement choisi, pour personnaliser la page de remerciement.
 * Tout accès est protégé : le stockage peut être indisponible (navigation privée, quota…).
 */

export const DRAFT_KEY = "activ:preinscription:draft:v1";
export const VERIFICATION_KEY = "activ:preinscription:email-verification:v1";
export const DONE_KEY = "activ:preinscription:done:v1";

const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Le serveur accepte une adresse vérifiée pendant 45 min : on garde une marge. */
const VERIFICATION_MAX_AGE_MS = 40 * 60 * 1000;

type StorageKind = "local" | "session";

const listeners = new Set<() => void>();

function area(kind: StorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(kind: StorageKind, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(kind: StorageKind, key: string, value: string | null, notify: boolean) {
  try {
    const storage = area(kind);
    if (!storage) return;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* stockage plein ou refusé : on continue sans sauvegarde */
  }
  if (notify) emit();
}

function readTimestamped(kind: StorageKind, key: string, maxAgeMs: number, field: string): string | null {
  const raw = readRaw(kind, key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const at = parsed[field];
    if (typeof at === "number" && Date.now() - at <= maxAgeMs) return raw;
  } catch {
    /* contenu illisible : on le jette */
  }
  writeRaw(kind, key, null, false);
  return null;
}

function useStoredRaw(read: () => string | null): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/* ------------------------------ Brouillon ------------------------------ */

export type DraftValues = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  selectedSlots: string[];
  paymentPlan: MembershipPaymentPlan;
  imageRights: "authorize" | "refuse" | "";
  acceptRules: boolean;
  acceptHealth: boolean;
  acceptInsurance: boolean;
  acceptRefund: boolean;
  signedPlace: string;
};

export type Draft = { version: 1; savedAt: number; step: string; values: DraftValues };

const readDraftRaw = () => readTimestamped("local", DRAFT_KEY, DRAFT_MAX_AGE_MS, "savedAt");

export function useDraftRaw(): string | null {
  return useStoredRaw(readDraftRaw);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

/** Relit un brouillon en vérifiant chaque champ (le stockage peut avoir été modifié ou venir d'une ancienne version). */
export function parseDraft(raw: string | null, knownSlotIds: ReadonlySet<string>): Draft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; savedAt?: unknown; step?: unknown; values?: Record<string, unknown> };
    if (parsed.version !== 1 || !parsed.values || typeof parsed.values !== "object") return null;
    const v = parsed.values;
    const slots = Array.isArray(v.selectedSlots)
      ? v.selectedSlots.filter((id): id is string => typeof id === "string" && knownSlotIds.has(id))
      : [];
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
      step: str(parsed.step),
      values: {
        firstName: str(v.firstName),
        lastName: str(v.lastName),
        birthDate: str(v.birthDate),
        phone: str(v.phone),
        address: str(v.address),
        postalCode: str(v.postalCode),
        city: str(v.city),
        email: str(v.email),
        emergencyContactName: str(v.emergencyContactName),
        emergencyContactPhone: str(v.emergencyContactPhone),
        selectedSlots: slots,
        paymentPlan: v.paymentPlan === "three_times" ? "three_times" : "once",
        imageRights: v.imageRights === "authorize" || v.imageRights === "refuse" ? v.imageRights : "",
        acceptRules: bool(v.acceptRules),
        acceptHealth: bool(v.acceptHealth),
        acceptInsurance: bool(v.acceptInsurance),
        acceptRefund: bool(v.acceptRefund),
        signedPlace: str(v.signedPlace),
      },
    };
  } catch {
    return null;
  }
}

/** Enregistre sans prévenir les composants (la sauvegarde automatique ne doit pas re-rendre la page). */
export function saveDraft(step: string, values: DraftValues) {
  const draft: Draft = { version: 1, savedAt: Date.now(), step, values };
  writeRaw("local", DRAFT_KEY, JSON.stringify(draft), false);
}

export function clearDraft() {
  writeRaw("local", DRAFT_KEY, null, true);
}

/* --------------------------- Vérification e-mail --------------------------- */

export type StoredVerification = {
  id: string;
  /** Adresse (en minuscules) pour laquelle le code a été validé. */
  email: string;
  accountExists: boolean;
  at: number;
};

const readVerificationRaw = () => readTimestamped("session", VERIFICATION_KEY, VERIFICATION_MAX_AGE_MS, "at");

export function useVerificationRaw(): string | null {
  return useStoredRaw(readVerificationRaw);
}

export function parseVerification(raw: string | null): StoredVerification | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredVerification>;
    if (typeof parsed.id !== "string" || typeof parsed.email !== "string") return null;
    return {
      id: parsed.id,
      email: parsed.email,
      accountExists: parsed.accountExists === true,
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

export function saveVerification(entry: { id: string; email: string; accountExists: boolean }) {
  const record: StoredVerification = { ...entry, at: Date.now() };
  writeRaw("session", VERIFICATION_KEY, JSON.stringify(record), true);
}

export function clearVerification() {
  writeRaw("session", VERIFICATION_KEY, null, true);
}

/* --------------------------- Page de remerciement --------------------------- */

export type DoneInfo = {
  firstName: string;
  email: string;
  paymentPlan: MembershipPaymentPlan;
  grandTotal: number;
  at: number;
};

const readDoneRaw = () => readRaw("session", DONE_KEY);

export function useDoneRaw(): string | null {
  return useStoredRaw(readDoneRaw);
}

export function parseDone(raw: string | null): DoneInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DoneInfo>;
    if (typeof parsed.firstName !== "string" || typeof parsed.email !== "string") return null;
    return {
      firstName: parsed.firstName,
      email: parsed.email,
      paymentPlan: parsed.paymentPlan === "three_times" ? "three_times" : "once",
      grandTotal: typeof parsed.grandTotal === "number" ? parsed.grandTotal : 0,
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

export function saveDone(info: Omit<DoneInfo, "at">) {
  writeRaw("session", DONE_KEY, JSON.stringify({ ...info, at: Date.now() }), false);
}
