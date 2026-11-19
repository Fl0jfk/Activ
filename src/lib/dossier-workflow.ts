import type { ApplicationDossierPhase, PaymentMethod, RegistrationApplication } from "@/lib/club-data";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";

/** Étapes métier d’un dossier (badge liste, mutuellement exclusives). */
export type DossierStep =
  | "new_request"
  | "awaiting_espace"
  | "missing_document"
  | "awaiting_payment"
  | "finalized"
  | "rejected"
  | "cancelled";

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
  awaiting_espace: "Valider l’espace adhérent",
  missing_document: "Pièce manquante",
  awaiting_payment: "Paiement en attente",
  finalized: "Inscription finalisée",
  rejected: "Dossier refusé",
  cancelled: "Adhésion arrêtée",
};

/** Libellés affichés dans l'espace membre. */
export const MEMBER_INSCRIPTION_LABELS: Record<DossierStep, string> = {
  new_request: "Inscription en cours de traitement",
  awaiting_espace: "Inscription en cours de traitement",
  missing_document: "Pièce manquante à fournir",
  awaiting_payment: "Paiement en attente",
  finalized: "Inscription finalisée",
  rejected: "Inscription refusée",
  cancelled: "Désinscrit",
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
  if (step === "cancelled") {
    return MEMBER_INSCRIPTION_LABELS.cancelled;
  }
  return MEMBER_INSCRIPTION_LABELS.new_request;
}

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

/* ------------------------------------------------------------------ */
/* Table des étapes de traitement : une seule source pour tout l’écran */
/* ------------------------------------------------------------------ */

export type DossierActionConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
};

export type DossierPhaseAction = {
  label: string;
  /** Courte explication affichée sous le bouton. */
  hint: string;
  /**
   * « update » : simple mise à jour du dossier.
   * « validate_espace » : ouverture de l’accès à l’espace adhérent.
   * « finalize » : enregistrement du paiement (le mode de paiement est ajouté à l’envoi).
   */
  kind: "update" | "validate_espace" | "finalize";
  payload?: ApplicationUpdatePayload;
  /** Message de réussite affiché près du dossier. */
  successMessage: string;
  confirm?: DossierActionConfirm;
};

type PhaseActionVariants = {
  online: DossierPhaseAction;
  /** Variante pour un adhérent papier (pas d’espace adhérent à valider). */
  paper?: DossierPhaseAction;
};

type DossierPhaseDefinition = {
  label: string;
  shortLabel: string;
  description: string;
  next?: PhaseActionVariants;
  back?: PhaseActionVariants;
};

const TO_PAYMENT_PAPER: DossierPhaseAction = {
  label: "Passer au paiement",
  hint: "Dossier papier : aucun espace adhérent à valider. Vous pouvez enregistrer directement le paiement.",
  kind: "update",
  payload: { dossierPhase: "payment", status: "approved" },
  successMessage: "Le dossier est passé à l’étape Paiement.",
  confirm: {
    title: "Passer au paiement ?",
    message:
      "Le dossier passe à l’étape « Paiement ». Vous pourrez ensuite enregistrer le règlement reçu.",
    confirmLabel: "Passer au paiement",
  },
};

const BACK_TO_RECEPTION: DossierPhaseAction = {
  label: "Revenir à la réception",
  hint: "Le dossier repasse à la première étape.",
  kind: "update",
  payload: { dossierPhase: "reception", status: "pending" },
  successMessage: "Le dossier est revenu à l’étape Réception.",
};

export const DOSSIER_PHASES: Record<DossierProcessingPhase, DossierPhaseDefinition> = {
  1: {
    label: "Réception",
    shortLabel: "Réception",
    description: "Dossier reçu : prenez connaissance des informations.",
    next: {
      online: {
        label: "Étape suivante : valider l’espace adhérent",
        hint: "Le dossier est bien reçu. Vous allez vérifier la demande, puis ouvrir l’accès de l’adhérent à son espace.",
        kind: "update",
        payload: { dossierPhase: "espace_validation", status: "pending" },
        successMessage: "Le dossier est passé à l’étape « Valider l’espace adhérent ».",
      },
      paper: TO_PAYMENT_PAPER,
    },
  },
  2: {
    label: "Valider l’espace adhérent",
    shortLabel: "Espace adhérent",
    description: "Vérifiez la demande puis autorisez l’adhérent à se connecter à son espace.",
    next: {
      online: {
        label: "Valider l’espace adhérent",
        hint: "L’adhérent pourra se connecter à son espace personnel. Les pièces seront vérifiées à l’étape suivante.",
        kind: "validate_espace",
        successMessage: "Espace adhérent validé : l’adhérent peut maintenant se connecter.",
        confirm: {
          title: "Valider l’espace adhérent ?",
          message:
            "L’adhérent pourra se connecter à son espace personnel avec son adresse e-mail. Vous traiterez ensuite ses pièces.",
          confirmLabel: "Valider l’espace",
        },
      },
      paper: TO_PAYMENT_PAPER,
    },
    back: { online: BACK_TO_RECEPTION },
  },
  3: {
    label: "Pièces à vérifier",
    shortLabel: "Pièces",
    description: "Contrôlez les pièces jointes et complétez le dossier si besoin.",
    next: {
      online: {
        label: "Pièces vérifiées : passer au paiement",
        hint: "Contrôlez les pièces dans la section « Pièces » ci-dessous. Si tout est en ordre, passez au paiement.",
        kind: "update",
        payload: { dossierPhase: "payment", status: "approved" },
        successMessage: "Pièces validées : le dossier est passé à l’étape Paiement.",
        confirm: {
          title: "Passer au paiement ?",
          message:
            "Vous confirmez que les pièces sont conformes. Le dossier passe à l’étape « Paiement ».",
          confirmLabel: "Passer au paiement",
        },
      },
    },
    back: {
      online: {
        label: "Revenir à la validation de l’espace adhérent",
        hint: "Le dossier repasse à l’étape précédente.",
        kind: "update",
        payload: { dossierPhase: "espace_validation", status: "pending" },
        successMessage: "Le dossier est revenu à l’étape « Valider l’espace adhérent ».",
      },
      paper: BACK_TO_RECEPTION,
    },
  },
  4: {
    label: "Paiement",
    shortLabel: "Paiement",
    description: "Les pièces sont conformes : enregistrez le paiement reçu.",
    next: {
      online: {
        label: "Paiement reçu : finaliser le dossier",
        hint: "Choisissez le mode de paiement reçu. Une attestation de paiement sera envoyée à l’adhérent.",
        kind: "finalize",
        payload: { dossierPhase: "finalized", status: "approved", paymentStatus: "paid" },
        successMessage: "Dossier finalisé : le paiement est enregistré.",
        confirm: {
          title: "Finaliser le dossier ?",
          message:
            "Le paiement sera enregistré et le dossier sera finalisé. Une attestation de paiement sera envoyée par e-mail à l’adhérent (si son adresse e-mail est renseignée).",
          confirmLabel: "Enregistrer le paiement",
        },
      },
    },
    back: {
      online: {
        label: "Revenir à la vérification des pièces",
        hint: "Le dossier repasse à l’étape précédente.",
        kind: "update",
        payload: { dossierPhase: "documents", status: "pending", paymentStatus: "unpaid" },
        successMessage: "Le dossier est revenu à l’étape « Pièces à vérifier ».",
        confirm: {
          title: "Revenir à la vérification des pièces ?",
          message:
            "Le dossier repasse à l’étape précédente. Aucun paiement n’est enregistré tant que vous n’avez pas finalisé le dossier.",
          confirmLabel: "Revenir en arrière",
        },
      },
    },
  },
  5: {
    label: "Finalisé",
    shortLabel: "Finalisé",
    description: "Paiement reçu : le dossier est terminé.",
    back: {
      online: {
        label: "Revenir au paiement",
        hint: "À utiliser en cas d’erreur de saisie du paiement.",
        kind: "update",
        payload: { dossierPhase: "payment", status: "approved", paymentStatus: "unpaid" },
        successMessage: "Le dossier est revenu à l’étape Paiement.",
        confirm: {
          title: "Annuler la finalisation ?",
          message:
            "Le paiement ne sera plus compté comme reçu et le dossier ne sera plus finalisé. En le finalisant de nouveau, une nouvelle attestation sera envoyée à l’adhérent.",
          confirmLabel: "Revenir au paiement",
          tone: "danger",
        },
      },
    },
  },
};

const PHASE_NUMBERS: DossierProcessingPhase[] = [1, 2, 3, 4, 5];

export const PROCESSING_PHASE_LABELS = Object.fromEntries(
  PHASE_NUMBERS.map((phase) => [phase, DOSSIER_PHASES[phase].label]),
) as Record<DossierProcessingPhase, string>;

export const PROCESSING_PHASE_DESCRIPTIONS = Object.fromEntries(
  PHASE_NUMBERS.map((phase) => [phase, DOSSIER_PHASES[phase].description]),
) as Record<DossierProcessingPhase, string>;

/** Action principale (« next ») ou de retour (« back ») d’un dossier, selon son étape et son origine. */
export function getPhaseAction(
  application: RegistrationApplication,
  direction: "next" | "back",
): DossierPhaseAction | null {
  const variants = DOSSIER_PHASES[getDossierProcessingPhase(application)][direction];
  if (!variants) return null;
  if (application.origin === "paper" && variants.paper) return variants.paper;
  return variants.online;
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

  if (application.status === "cancelled") {
    return "cancelled";
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
  return step !== "finalized" && step !== "rejected" && step !== "cancelled";
}

export function isDossierFinalise(application: RegistrationApplication): boolean {
  return getDossierStep(application) === "finalized";
}

/** Dossier refusé ou adhérent désinscrit. */
export function isDossierRefuse(application: RegistrationApplication): boolean {
  const step = getDossierStep(application);
  return step === "rejected" || step === "cancelled";
}

export type DossierBadgeTone = "blue" | "green" | "orange" | "rose" | "violet" | "slate";

/** Badge précis affiché dans la liste : l’étape de traitement réelle du dossier. */
export function getDossierBadge(application: RegistrationApplication): {
  label: string;
  tone: DossierBadgeTone;
} {
  const step = getDossierStep(application);
  switch (step) {
    case "rejected":
      return { label: DOSSIER_STEP_LABELS.rejected, tone: "slate" };
    case "cancelled":
      return { label: DOSSIER_STEP_LABELS.cancelled, tone: "rose" };
    case "finalized":
      return { label: "Finalisé", tone: "green" };
    case "missing_document":
      return { label: "Pièce demandée à l’adhérent", tone: "orange" };
    default:
      break;
  }
  const phase = getDossierProcessingPhase(application);
  const tones: Record<DossierProcessingPhase, DossierBadgeTone> = {
    1: "blue",
    2: "violet",
    3: "orange",
    4: "orange",
    5: "green",
  };
  return { label: PROCESSING_PHASE_LABELS[phase], tone: tones[phase] };
}

/** Toutes les activités d'un dossier, y compris celles ajoutées via le bulletin. */
export function getApplicationDisciplineIds(
  application: RegistrationApplication,
): string[] {
  const ids = [
    ...(application.disciplineIds ?? []),
    ...(application.membershipBulletin?.selectedDisciplineIds ?? []),
    application.disciplineId,
  ];
  return Array.from(
    new Set(ids.filter((id): id is string => Boolean(id && id.trim()))),
  );
}

/** Libellés uniques des activités d'un dossier, dans l'ordre du bulletin. */
export function getApplicationDisciplineNames(
  application: RegistrationApplication,
  disciplines: { id: string; name: string }[],
): string[] {
  const names = getApplicationDisciplineIds(application)
    .map((id) => disciplines.find((discipline) => discipline.id === id)?.name?.trim())
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}

/* ------------------------------------------------------------------ */
/* Filtres de la liste des dossiers                                    */
/* ------------------------------------------------------------------ */

export type QueueFilter = "en_cours" | "finalized" | "refuses" | "all";

export function parseQueueFilter(value: string | null | undefined): QueueFilter {
  return value === "finalized" || value === "refuses" || value === "all" ? value : "en_cours";
}

export function filterApplicationsByQueue(
  applications: RegistrationApplication[],
  queueFilter: QueueFilter
): RegistrationApplication[] {
  switch (queueFilter) {
    case "en_cours":
      return applications.filter(isDossierEnCours);
    case "finalized":
      return applications.filter(isDossierFinalise);
    case "refuses":
      return applications.filter(isDossierRefuse);
    case "all":
    default:
      return applications;
  }
}

/** Filtre d’étape proposé par les liens du cockpit (`?etape=`), valable pour les dossiers en cours. */
export type StepFilter = "a_examiner" | "pieces" | "paiement";

export const STEP_FILTER_LABELS: Record<StepFilter, string> = {
  a_examiner: "À examiner",
  pieces: "Pièces manquantes",
  paiement: "Paiement en attente",
};

const STEP_FILTER_STEPS: Record<StepFilter, DossierStep[]> = {
  a_examiner: ["new_request", "awaiting_espace"],
  pieces: ["missing_document"],
  paiement: ["awaiting_payment"],
};

export function parseStepFilter(value: string | null | undefined): StepFilter | null {
  return value === "a_examiner" || value === "pieces" || value === "paiement" ? value : null;
}

export function matchesStepFilter(
  application: RegistrationApplication,
  stepFilter: StepFilter,
): boolean {
  return STEP_FILTER_STEPS[stepFilter].includes(getDossierStep(application));
}

export function stepBadgeClass(step: DossierStep): string {
  switch (step) {
    case "missing_document":
      return "bg-amber-100 text-amber-900";
    case "awaiting_espace":
      return "bg-violet-100 text-violet-800";
    case "awaiting_payment":
      return "bg-amber-100 text-amber-900";
    case "new_request":
      return "bg-brand-blue/12 text-brand-blue-dark";
    case "finalized":
      return "bg-brand-green/15 text-brand-green-dark";
    case "rejected":
      return "bg-slate-200 text-slate-700";
    case "cancelled":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
