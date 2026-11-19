import {
  cleanLine,
  isValidEmailAddress,
  isValidFrenchPostalCode,
  normalizePhoneNumber,
  validateBirthDate,
  validatePasswordRules,
} from "@/lib/input-validation";

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
  /** Libellés lisibles des activités cochées (PDF, reçu, espace membre). */
  selectedActivityLabels?: string[];
  /** Toutes les disciplines concernées par le bulletin (et pas seulement la principale). */
  selectedDisciplineIds?: string[];
  paymentPlan: MembershipPaymentPlan;
  imageRights: MembershipImageRights;
  commitmentsAccepted: boolean;
  signedAt: string;
  signedPlace: string;
  activitiesTotal: number;
  grandTotal: number;
};

/** Source d'activités utilisée pour valider et enregistrer un bulletin. */
export type MembershipActivityLookup = {
  id: string;
  activity?: string;
  day?: string;
  time?: string;
  disciplineId?: string | null;
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

function fallbackActivityLabel(activityId: string): string {
  const legacy = MEMBERSHIP_ACTIVITY_SLOTS.find((slot) => slot.id === activityId);
  if (!legacy) return activityId;
  return `${legacy.day} ${legacy.time} — ${legacy.activity}`;
}

/** Complète un bulletin avec les libellés et disciplines réellement cochés. */
export function membershipActivityDetails(
  selectedSlots: string[],
  activityOptions?: MembershipActivityLookup[],
): { labels: string[]; disciplineIds: string[] } {
  const optionsById = new Map((activityOptions ?? []).map((option) => [option.id, option]));
  const labels: string[] = [];
  const disciplineIds: string[] = [];

  for (const slotId of selectedSlots) {
    const option = optionsById.get(slotId);
    if (option) {
      const day = option.day?.trim() ?? "";
      const time = option.time?.trim() ?? "";
      const activity = option.activity?.trim() ?? "";
      const scheduleLabel = [day, time].filter(Boolean).join(" ");
      labels.push([scheduleLabel, activity].filter(Boolean).join(" — ") || slotId);
      if (option.disciplineId && !disciplineIds.includes(option.disciplineId)) {
        disciplineIds.push(option.disciplineId);
      }
      continue;
    }
    labels.push(fallbackActivityLabel(slotId));
  }

  return { labels, disciplineIds };
}

export type BulletinFieldName =
  | "firstName"
  | "lastName"
  | "birthDate"
  | "phone"
  | "address"
  | "postalCode"
  | "city"
  | "email"
  | "password"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "selectedSlots"
  | "signature"
  | "commitments";

export type BulletinFieldErrors = Partial<Record<BulletinFieldName, string>>;

export type BulletinValidationResult =
  | { ok: true; payload: MembershipBulletinFormPayload }
  | { ok: false; message: string; fieldErrors: BulletinFieldErrors };

export const BULLETIN_LIMITS = {
  name: 60,
  address: 160,
  city: 80,
  contactName: 100,
  place: 80,
  email: 254,
  slots: 20,
  signatureDataUrl: 1_000_000,
} as const;

export const SIGNATURE_DATA_URL_PREFIX = "data:image/png;base64,";

const FIELD_ORDER: BulletinFieldName[] = [
  "firstName",
  "lastName",
  "birthDate",
  "phone",
  "address",
  "postalCode",
  "city",
  "email",
  "password",
  "emergencyContactName",
  "emergencyContactPhone",
  "selectedSlots",
  "commitments",
  "signature",
];

/** Date de signature « jj/mm/aaaa » fixée par le serveur (heure de Paris), jamais celle envoyée par le navigateur. */
export function serverSignedAt(now: Date = new Date()): string {
  return now.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Contrôle et nettoie les données d'un bulletin reçues d'un navigateur (valeurs inconnues acceptées).
 * Renvoie les valeurs nettoyées (téléphones normalisés, activités sans doublon, date de signature du serveur).
 * Le contenu de l'image de signature est contrôlé à part (voir `signature-image.ts`).
 */
export function validateMembershipBulletinPayload(
  raw: unknown,
  options?: { requirePassword?: boolean; activityOptions?: MembershipActivityLookup[]; now?: Date },
): BulletinValidationResult {
  const requirePassword = options?.requirePassword ?? true;
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: BulletinFieldErrors = {};

  const text = (key: string, max: number) => cleanLine(source[key], max + 1);
  const tooLong = (value: string, max: number) => value.length > max;

  const firstName = text("firstName", BULLETIN_LIMITS.name);
  if (!firstName) errors.firstName = "Indiquez votre prénom.";
  else if (tooLong(firstName, BULLETIN_LIMITS.name)) errors.firstName = "Prénom trop long.";

  const lastName = text("lastName", BULLETIN_LIMITS.name);
  if (!lastName) errors.lastName = "Indiquez votre nom.";
  else if (tooLong(lastName, BULLETIN_LIMITS.name)) errors.lastName = "Nom trop long.";

  const birth = validateBirthDate(source.birthDate, options?.now);
  if (!birth.ok) errors.birthDate = birth.message;

  const phone = normalizePhoneNumber(source.phone);
  if (!phone) errors.phone = "Numéro de téléphone invalide (exemple : 06 12 34 56 78).";

  const address = text("address", BULLETIN_LIMITS.address);
  if (!address) errors.address = "Indiquez votre adresse.";
  else if (tooLong(address, BULLETIN_LIMITS.address)) errors.address = "Adresse trop longue.";

  const postalCode = typeof source.postalCode === "string" ? source.postalCode.trim() : "";
  if (!isValidFrenchPostalCode(postalCode)) errors.postalCode = "Code postal invalide (5 chiffres).";

  const city = text("city", BULLETIN_LIMITS.city);
  if (!city) errors.city = "Indiquez votre ville.";
  else if (tooLong(city, BULLETIN_LIMITS.city)) errors.city = "Nom de ville trop long.";

  const email = typeof source.email === "string" ? source.email.trim().toLowerCase() : "";
  if (!isValidEmailAddress(email)) errors.email = "Adresse e-mail invalide.";

  let password = "";
  if (requirePassword) {
    const passwordCheck = validatePasswordRules(source.password);
    if (!passwordCheck.ok) errors.password = passwordCheck.message;
    else password = source.password as string;
  }

  const emergencyContactName = text("emergencyContactName", BULLETIN_LIMITS.contactName);
  if (!emergencyContactName) {
    errors.emergencyContactName = "Indiquez le nom de la personne à prévenir en cas d'urgence.";
  } else if (tooLong(emergencyContactName, BULLETIN_LIMITS.contactName)) {
    errors.emergencyContactName = "Nom trop long.";
  }

  const emergencyContactPhone = normalizePhoneNumber(source.emergencyContactPhone);
  if (!emergencyContactPhone) {
    errors.emergencyContactPhone = "Téléphone du contact d'urgence invalide (exemple : 06 12 34 56 78).";
  }

  const allowedActivities = new Map<string, MembershipActivityLookup>(
    options?.activityOptions?.length
      ? options.activityOptions.map((option) => [option.id, option])
      : MEMBERSHIP_ACTIVITY_SLOTS.map((slot) => [slot.id, { id: slot.id }]),
  );
  const rawSlots = source.selectedSlots;
  const selectedSlots: string[] = [];
  if (!Array.isArray(rawSlots) || rawSlots.length === 0) {
    errors.selectedSlots = "Veuillez cocher au moins une activité.";
  } else if (rawSlots.length > BULLETIN_LIMITS.slots * 2) {
    errors.selectedSlots = "Trop d'activités sélectionnées.";
  } else {
    for (const slot of rawSlots) {
      if (typeof slot !== "string" || !allowedActivities.has(slot)) {
        errors.selectedSlots = "Une activité choisie n'est plus proposée. Rechargez la page et choisissez à nouveau.";
        break;
      }
      if (!selectedSlots.includes(slot)) selectedSlots.push(slot);
    }
    if (!errors.selectedSlots && selectedSlots.length > BULLETIN_LIMITS.slots) {
      errors.selectedSlots = "Trop d'activités sélectionnées.";
    }
  }

  const paymentPlan = source.paymentPlan;
  if (paymentPlan !== "once" && paymentPlan !== "three_times") {
    errors.selectedSlots = errors.selectedSlots ?? "Choisissez une modalité de paiement.";
  }
  const imageRights = source.imageRights;
  if (imageRights !== "authorize" && imageRights !== "refuse") {
    errors.selectedSlots = errors.selectedSlots ?? "Choisissez votre réponse pour le droit à l'image.";
  }

  if (source.commitmentsAccepted !== true) {
    errors.commitments = "Vous devez accepter les engagements du bulletin.";
  }

  const signatureDataUrl = typeof source.signatureDataUrl === "string" ? source.signatureDataUrl : "";
  if (
    !signatureDataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX) ||
    signatureDataUrl.length > BULLETIN_LIMITS.signatureDataUrl ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(signatureDataUrl.slice(SIGNATURE_DATA_URL_PREFIX.length))
  ) {
    errors.signature = "Signature manquante ou invalide. Signez à nouveau dans l'encadré.";
  }

  const failed = FIELD_ORDER.filter((field) => errors[field]);
  if (failed.length > 0) {
    return {
      ok: false,
      message:
        failed.length === 1
          ? errors[failed[0]!]!
          : "Certaines informations sont manquantes ou invalides. Vérifiez les champs signalés.",
      fieldErrors: errors,
    };
  }

  return {
    ok: true,
    payload: {
      firstName,
      lastName,
      phone: phone!,
      address,
      postalCode,
      city,
      email,
      password: password || undefined,
      birthDate: (birth as { ok: true; value: string }).value,
      emergencyContactName,
      emergencyContactPhone: emergencyContactPhone!,
      selectedSlots,
      paymentPlan: paymentPlan as MembershipPaymentPlan,
      imageRights: imageRights as MembershipImageRights,
      commitmentsAccepted: true,
      signedPlace: cleanLine(source.signedPlace, BULLETIN_LIMITS.place) || "Sainte-Croix",
      signedAt: serverSignedAt(options?.now),
      signatureDataUrl,
    },
  };
}
export function buildMembershipBulletinRecord(
  payload: MembershipBulletinFormPayload,
  options?: { activityOptions?: MembershipActivityLookup[] },
): MembershipBulletinData {
  const totals = computeMembershipTotals(payload.selectedSlots);
  const details = membershipActivityDetails(payload.selectedSlots, options?.activityOptions);
  return {
    birthDate: payload.birthDate.trim(),
    emergencyContactName: payload.emergencyContactName.trim(),
    emergencyContactPhone: payload.emergencyContactPhone.trim(),
    selectedSlots: [...payload.selectedSlots],
    selectedActivityLabels: details.labels,
    selectedDisciplineIds: details.disciplineIds,
    paymentPlan: payload.paymentPlan,
    imageRights: payload.imageRights,
    commitmentsAccepted: true,
    signedAt: payload.signedAt.trim(),
    signedPlace: payload.signedPlace.trim() || "Sainte-Croix",
    activitiesTotal: totals.activitiesTotal,
    grandTotal: totals.grandTotal,
  };
}
