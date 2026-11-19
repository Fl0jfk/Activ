import type {
  ApplicationStatus,
  ClubData,
  RegistrationApplication,
  TrialSlot,
} from "@/lib/club-data";
import { isoToParisLocalInput, parisLocalToIso } from "@/lib/paris-time";

export type TrialSlotListItem = Pick<TrialSlot, "id" | "title" | "startsAt" | "capacity"> & {
  registeredCount: number;
};

export type TrialSlotValidationResult =
  | { ok: true; slot: TrialSlot }
  | { ok: false; message: string; status: number };

/** Personne inscrite à un créneau d'essai (données minimales pour le bureau). */
export type TrialRegistrant = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: ApplicationStatus;
};

/** Créneau d'essai prêt à afficher : date en instant ISO (UTC) et liste des inscrits. */
export type TrialSlotRow = {
  id: string;
  disciplineId: string;
  title: string;
  startsAt: string;
  capacity: number;
  registrants: TrialRegistrant[];
};

const NAIVE_LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * Renvoie l'instant ISO (UTC) d'un créneau. Les anciens créneaux ont été enregistrés
 * tels quels depuis un champ « datetime-local » (sans fuseau) : on les lit comme
 * une heure de Paris, jamais comme celle du serveur ou du navigateur.
 */
export function trialSlotInstantIso(startsAt: string): string {
  const value = startsAt.trim();
  if (NAIVE_LOCAL_DATETIME.test(value)) {
    return parisLocalToIso(value) ?? value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function trialSlotTime(startsAt: string): number {
  return new Date(trialSlotInstantIso(startsAt)).getTime();
}

export type TrialSlotStartResult = { ok: true; startsAt: string } | { ok: false; message: string };

/** Convertit la saisie du formulaire (heure de Paris) en instant ISO et refuse les dates passées. */
export function parseTrialSlotStartsAt(input: unknown, now = Date.now()): TrialSlotStartResult {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, message: "Indiquez la date et l'heure du créneau." };
  }
  const value = input.trim();
  let iso: string | null;
  if (NAIVE_LOCAL_DATETIME.test(value)) {
    iso = parisLocalToIso(value);
    // Refuse les dates qui n'existent pas (31 février) ou les heures sautées au changement d'heure.
    if (!iso || isoToParisLocalInput(iso) !== value.slice(0, 16)) {
      return { ok: false, message: "La date ou l'heure indiquée n'est pas valide." };
    }
  } else {
    const date = new Date(value);
    iso = Number.isNaN(date.getTime()) ? null : date.toISOString();
    if (!iso) {
      return { ok: false, message: "La date ou l'heure indiquée n'est pas valide." };
    }
  }
  if (new Date(iso).getTime() <= now) {
    return { ok: false, message: "Ce créneau est déjà passé : choisissez une date à venir." };
  }
  return { ok: true, startsAt: iso };
}

export function countTrialSlotRegistrations(
  applications: RegistrationApplication[],
  slotId: string,
): number {
  return applications.filter(
    (entry) => entry.trialSlotId === slotId && entry.status !== "rejected",
  ).length;
}

export function formatTrialSlotDate(iso: string): string {
  return new Date(trialSlotInstantIso(iso)).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Créneaux actifs triés par date, avec leurs inscrits (hors dossiers refusés). */
export function buildTrialSlotRows(clubData: ClubData): TrialSlotRow[] {
  return clubData.trialSlots
    .filter((slot) => slot.active)
    .map((slot) => ({
      id: slot.id,
      disciplineId: slot.disciplineId,
      title: slot.title,
      startsAt: trialSlotInstantIso(slot.startsAt),
      capacity: slot.capacity,
      registrants: clubData.applications
        .filter((entry) => entry.trialSlotId === slot.id && entry.status !== "rejected")
        .map((entry) => ({
          id: entry.id,
          name: entry.fullName || `${entry.firstName} ${entry.lastName}`.trim(),
          email: entry.email,
          phone: entry.phone,
          status: entry.status,
        })),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function listUpcomingTrialSlots(
  clubData: ClubData,
  options?: { disciplineId?: string; referenceTime?: number },
): TrialSlotListItem[] {
  const now = options?.referenceTime ?? Date.now();
  return clubData.trialSlots
    .filter(
      (slot) =>
        slot.active &&
        (!options?.disciplineId || slot.disciplineId === options.disciplineId) &&
        trialSlotTime(slot.startsAt) >= now,
    )
    .sort((a, b) => trialSlotTime(a.startsAt) - trialSlotTime(b.startsAt))
    .map((slot) => ({
      id: slot.id,
      title: slot.title,
      startsAt: trialSlotInstantIso(slot.startsAt),
      capacity: slot.capacity,
      registeredCount: countTrialSlotRegistrations(clubData.applications, slot.id),
    }));
}

export function validateTrialSlotForRegistration(
  data: ClubData,
  payload: { disciplineId: string; trialSlotId: string },
): TrialSlotValidationResult {
  const slot = data.trialSlots.find((entry) => entry.id === payload.trialSlotId && entry.active);
  if (!slot) {
    return { ok: false, message: "Créneau d'essai introuvable.", status: 404 };
  }
  if (slot.disciplineId !== payload.disciplineId) {
    return { ok: false, message: "Ce créneau ne correspond pas à la discipline choisie.", status: 400 };
  }
  if (trialSlotTime(slot.startsAt) < Date.now()) {
    return { ok: false, message: "Ce créneau d'essai est passé.", status: 400 };
  }
  const registered = countTrialSlotRegistrations(data.applications, slot.id);
  if (registered >= slot.capacity) {
    return { ok: false, message: "Ce créneau d'essai est complet.", status: 409 };
  }
  return { ok: true, slot };
}
