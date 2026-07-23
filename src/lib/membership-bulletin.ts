export const MEMBERSHIP_SEASON_LABEL = "Saison 2026 - 2027";
export const MEMBERSHIP_ADHESION_FEE = 10;

export type MembershipPaymentPlan = "once" | "three_times";
export type MembershipImageRights = "authorize" | "refuse";

export type MembershipActivitySlot = {
  id: string;
  day: string;
  time: string;
  activity: string;
  /** Slug/name hint to match site disciplines when possible */
  matchKeywords: string[];
};

export const MEMBERSHIP_ACTIVITY_SLOTS: MembershipActivitySlot[] = [
  {
    id: "yoga-chaise-lundi",
    day: "Lundi",
    time: "14h30-15h30",
    activity: "Yoga sur chaise",
    matchKeywords: ["yoga", "chaise"],
  },
  {
    id: "renforcement-jeudi",
    day: "Jeudi",
    time: "18h30-19h30",
    activity: "Renforcement musculaire / Cardio",
    matchKeywords: ["renforcement", "cardio", "musculaire"],
  },
  {
    id: "pilates-jeudi",
    day: "Jeudi",
    time: "19h30-20h30",
    activity: "Pilates",
    matchKeywords: ["pilates"],
  },
  {
    id: "yoga-vendredi",
    day: "Vendredi",
    time: "17h45-18h45",
    activity: "Yoga",
    matchKeywords: ["yoga"],
  },
];

export type MembershipBulletinData = {
  birthDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  selectedSlots: string[];
  paymentPlan: MembershipPaymentPlan;
  imageRights: MembershipImageRights;
  commitmentsAccepted: boolean;
  signedAt: string;
  signedPlace: string;
  activitiesTotal: number;
  grandTotal: number;
};

export type MembershipBulletinFormPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  password?: string;
  birthDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  selectedSlots: string[];
  paymentPlan: MembershipPaymentPlan;
  imageRights: MembershipImageRights;
  commitmentsAccepted: boolean;
  signedPlace: string;
  signedAt: string;
  signatureDataUrl: string;
};

export function activitiesFeeForCount(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 180;
  if (count === 2) return 260;
  return 320;
}

export function computeMembershipTotals(selectedSlots: string[]): {
  activitiesTotal: number;
  grandTotal: number;
} {
  const count = selectedSlots.length;
  const activitiesTotal = activitiesFeeForCount(count);
  return {
    activitiesTotal,
    grandTotal: count > 0 ? MEMBERSHIP_ADHESION_FEE + activitiesTotal : 0,
  };
}

export function getSelectedSlotLabels(selectedSlots: string[]): string[] {
  return MEMBERSHIP_ACTIVITY_SLOTS.filter((slot) => selectedSlots.includes(slot.id)).map(
    (slot) => `${slot.day} ${slot.time} — ${slot.activity}`,
  );
}

export function paymentPlanLabel(plan: MembershipPaymentPlan): string {
  if (plan === "three_times") {
    return "Paiement en 3 fois (chèques encaissés le 10 septembre 2026, le 10 janvier 2027 et le 10 avril 2027)";
  }
  return "Paiement en 1 fois à l'inscription (chèque, virement ou espèces)";
}

export function imageRightsLabel(value: MembershipImageRights): string {
  return value === "authorize"
    ? "J'autorise l'utilisation de mon image"
    : "Je n'autorise pas l'utilisation de mon image";
}

export function resolvePrimaryDisciplineId(
  selectedSlots: string[],
  disciplines: { id: string; name: string; slug: string }[],
): string | null {
  for (const slotId of selectedSlots) {
    const slot = MEMBERSHIP_ACTIVITY_SLOTS.find((entry) => entry.id === slotId);
    if (!slot) continue;
    const matched = disciplines.find((discipline) => {
      const haystack = `${discipline.name} ${discipline.slug}`.toLowerCase();
      return slot.matchKeywords.every((keyword) => haystack.includes(keyword.toLowerCase()));
    });
    if (matched) return matched.id;
  }
  for (const slotId of selectedSlots) {
    const slot = MEMBERSHIP_ACTIVITY_SLOTS.find((entry) => entry.id === slotId);
    if (!slot) continue;
    const matched = disciplines.find((discipline) => {
      const haystack = `${discipline.name} ${discipline.slug}`.toLowerCase();
      return slot.matchKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    });
    if (matched) return matched.id;
  }
  return disciplines[0]?.id ?? null;
}

export function validateMembershipBulletinPayload(
  payload: MembershipBulletinFormPayload,
  options?: { requirePassword?: boolean },
): { ok: true } | { ok: false; message: string } {
  const requirePassword = options?.requirePassword ?? true;
  if (
    !payload.firstName?.trim() ||
    !payload.lastName?.trim() ||
    !payload.phone?.trim() ||
    !payload.address?.trim() ||
    !payload.postalCode?.trim() ||
    !payload.city?.trim() ||
    !payload.email?.trim() ||
    !payload.birthDate?.trim() ||
    !payload.emergencyContactName?.trim() ||
    !payload.emergencyContactPhone?.trim()
  ) {
    return { ok: false, message: "Merci de remplir toutes les coordonnées obligatoires." };
  }
  if (requirePassword && (!payload.password || payload.password.length < 8)) {
    return { ok: false, message: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (!Array.isArray(payload.selectedSlots) || payload.selectedSlots.length === 0) {
    return { ok: false, message: "Veuillez cocher au moins une activité." };
  }
  const unknownSlot = payload.selectedSlots.some(
    (id) => !MEMBERSHIP_ACTIVITY_SLOTS.some((slot) => slot.id === id),
  );
  if (unknownSlot) {
    return { ok: false, message: "Créneau d'activité invalide." };
  }
  if (payload.paymentPlan !== "once" && payload.paymentPlan !== "three_times") {
    return { ok: false, message: "Modalité de paiement invalide." };
  }
  if (payload.imageRights !== "authorize" && payload.imageRights !== "refuse") {
    return { ok: false, message: "Choix du droit à l'image invalide." };
  }
  if (!payload.commitmentsAccepted) {
    return { ok: false, message: "Vous devez accepter les engagements du bulletin." };
  }
  if (!payload.signatureDataUrl?.startsWith("data:image/")) {
    return { ok: false, message: "Signature manquante ou invalide." };
  }
  if (!payload.signedAt?.trim()) {
    return { ok: false, message: "Date de signature manquante." };
  }
  return { ok: true };
}

export function buildMembershipBulletinRecord(
  payload: MembershipBulletinFormPayload,
): MembershipBulletinData {
  const totals = computeMembershipTotals(payload.selectedSlots);
  return {
    birthDate: payload.birthDate.trim(),
    emergencyContactName: payload.emergencyContactName.trim(),
    emergencyContactPhone: payload.emergencyContactPhone.trim(),
    selectedSlots: [...payload.selectedSlots],
    paymentPlan: payload.paymentPlan,
    imageRights: payload.imageRights,
    commitmentsAccepted: true,
    signedAt: payload.signedAt.trim(),
    signedPlace: payload.signedPlace.trim() || "Sainte-Croix",
    activitiesTotal: totals.activitiesTotal,
    grandTotal: totals.grandTotal,
  };
}
