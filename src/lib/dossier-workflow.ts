import type { ApplicationDossierPhase, PaymentMethod, RegistrationApplication } from "@/lib/club-data";

/** Étapes métier d’un dossier (badge liste, mutuellement exclusives). */
export type DossierStep =
  | "new_request"
  | "awaiting_espace"
  | "missing_document"
  | "awaiting_payment"
  | "finalized"
  | "rejected";

/** Étapes du traitement à l’intérieur d’un dossier ouvert (1 → 5). */
export type DossierProcessingPhase = 1 | 2 | 3 | 4 | 5;

const PHASE_TO_NUMBER: Record<ApplicationDossierPhase, DossierProcessingPhase> = {
  reception: 1,
  espace_validation: 2,
  documents: 3,
  payment: 4,
  finalized: 5,
};

export const DOSSIER_STEP_LABELS: Record<DossierStep, string> = {
  new_request: "À examiner",
  awaiting_espace: "Espace en attente",
  missing_document: "Pièce manquante",
  awaiting_payment: "Paiement en attente",
  finalized: "Inscription finalisée",
  rejected: "Dossier refusé",
};

/** Libellés affichés dans l'espace membre. */
export const MEMBER_INSCRIPTION_LABELS: Record<DossierStep, string> = {
  new_request: "Inscription en cours de traitement",
  awaiting_espace: "Inscription en cours de traitement",
  missing_document: "Pièce manquante à fournir",
  awaiting_payment: "Paiement en attente",
  finalized: "Inscription finalisée",
  rejected: "Inscription refusée",
};

export function getMemberInscriptionStep(application: RegistrationApplication): DossierStep {
  return getDossierStep(application);
}

/** Libellé membre tenant compte de la phase dossier (ex. pièces en vérification). */
export function getMemberInscriptionLabel(application: RegistrationApplication): string {
  const step = getDossierStep(application);
  if (step === "missing_document") {
    return MEMBER_INSCRIPTION_LABELS.missing_document;
  }
  const phase = getApplicationDossierPhase(application);
  if (phase === "documents") {
    return "Pièces en vérification";
  }
  if (phase === "payment" || step === "awaiting_payment") {
    return MEMBER_INSCRIPTION_LABELS.awaiting_payment;
  }
  if (step === "finalized") {
    return MEMBER_INSCRIPTION_LABELS.finalized;
  }
  if (step === "rejected") {
    return MEMBER_INSCRIPTION_LABELS.rejected;
  }
  return MEMBER_INSCRIPTION_LABELS.new_request;
}

export const PROCESSING_PHASE_LABELS: Record<DossierProcessingPhase, string> = {
  1: "Réception",
  2: "Valider l'espace",
  3: "Pièces à vérifier",
  4: "Paiement",
  5: "Finalisé",
};

export const PROCESSING_PHASE_DESCRIPTIONS: Record<DossierProcessingPhase, string> = {
  1: "Dossier reçu — prendre connaissance des informations.",
  2: "Vérifier la demande et activer l'accès à l'espace membre Clerk.",
  3: "Vérifier les pièces jointes et compléter le dossier si besoin.",
  4: "Les pièces sont conformes — enregistrer le paiement.",
  5: "Paiement reçu — dossier terminé.",
};

export const PAYMENT_METHOD_OPTIONS: { value: Exclude<PaymentMethod, "">; label: string }[] = [
  { value: "cash", label: "Espèces" },
  { value: "check", label: "Chèque" },
  { value: "bank_transfer", label: "Virement" },
  { value: "card", label: "Carte" },
  { value: "other", label: "Autre" },
];

export function paymentMethodLabel(method: PaymentMethod): string {
  if (!method) return "Non renseigné";
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

export function getApplicationDossierPhase(application: RegistrationApplication): ApplicationDossierPhase {
  if (application.dossierPhase) {
    return application.dossierPhase;
  }
  if (application.status === "approved" && application.paymentStatus === "paid") {
    return "finalized";
  }
  if (application.status === "approved") {
    return "payment";
  }
  if (application.clerkUserId) {
    return "documents";
  }
  return "reception";
}

export function getDossierProcessingPhase(application: RegistrationApplication): DossierProcessingPhase {
  return PHASE_TO_NUMBER[getApplicationDossierPhase(application)];
}

export function getDossierStep(application: RegistrationApplication): DossierStep {
  if (application.status === "rejected") {
    return "rejected";
  }

  if (application.status === "approved" && application.paymentStatus === "paid") {
    return "finalized";
  }

  if (application.status === "awaiting_document") {
    return "missing_document";
  }

  if (application.status === "approved") {
    return "awaiting_payment";
  }

  const phase = getApplicationDossierPhase(application);
  if (phase === "espace_validation") {
    return "awaiting_espace";
  }

  return "new_request";
}

export function isDossierEnCours(application: RegistrationApplication): boolean {
  const step = getDossierStep(application);
  return step !== "finalized" && step !== "rejected";
}

export function isDossierFinalise(application: RegistrationApplication): boolean {
  return getDossierStep(application) === "finalized";
}

export type QueueFilter = "en_cours" | "finalized" | "all";

export function filterApplicationsByQueue(
  applications: RegistrationApplication[],
  queueFilter: QueueFilter
): RegistrationApplication[] {
  switch (queueFilter) {
    case "en_cours":
      return applications.filter(isDossierEnCours);
    case "finalized":
      return applications.filter(isDossierFinalise);
    case "all":
    default:
      return applications;
  }
}

export function stepBadgeClass(step: DossierStep): string {
  switch (step) {
    case "missing_document":
      return "bg-rose-100 text-rose-800";
    case "awaiting_espace":
      return "bg-violet-100 text-violet-800";
    case "awaiting_payment":
      return "bg-orange-100 text-orange-800";
    case "new_request":
      return "bg-cyan-100 text-cyan-800";
    case "finalized":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
