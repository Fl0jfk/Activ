import type { ClubData, RegistrationApplication, TrialSlot } from "@/lib/club-data";

export type TrialSlotListItem = Pick<TrialSlot, "id" | "title" | "startsAt" | "capacity"> & {
  registeredCount: number;
};

export type TrialSlotValidationResult =
  | { ok: true; slot: TrialSlot }
  | { ok: false; message: string; status: number };

export function countTrialSlotRegistrations(
  applications: RegistrationApplication[],
  slotId: string,
): number {
  return applications.filter(
    (entry) => entry.trialSlotId === slotId && entry.status !== "rejected",
  ).length;
}

export function formatTrialSlotDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        new Date(slot.startsAt).getTime() >= now,
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((slot) => ({
      id: slot.id,
      title: slot.title,
      startsAt: slot.startsAt,
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
    return { ok: false, message: "Creneau d'essai introuvable.", status: 404 };
  }
  if (slot.disciplineId !== payload.disciplineId) {
    return { ok: false, message: "Ce creneau ne correspond pas a la discipline choisie.", status: 400 };
  }
  if (new Date(slot.startsAt).getTime() < Date.now()) {
    return { ok: false, message: "Ce creneau d'essai est passe.", status: 400 };
  }
  const registered = countTrialSlotRegistrations(data.applications, slot.id);
  if (registered >= slot.capacity) {
    return { ok: false, message: "Ce creneau d'essai est complet.", status: 409 };
  }
  return { ok: true, slot };
}
