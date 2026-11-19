import type {
  ApplicationDossierPhase,
  ApplicationStatus,
  ClubData,
  DocumentRequestToken,
  PaymentMethod,
  PaymentStatus,
  ReceiptHistoryEntry,
  RegistrationApplication,
} from "@/lib/club-data";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";
import {
  PROCESSING_PHASE_LABELS,
  getApplicationDossierPhase,
  getDossierProcessingPhase,
  getPhaseAction,
} from "@/lib/dossier-workflow";
import { secureToken } from "@/lib/ids";
import { nextLicenseEndDate } from "@/lib/license-renewal";
import type { AppRole } from "@/lib/roles";
import { isValidIsoDate, todayParisIso } from "@/lib/schedule-week";

/**
 * Source unique des règles du dossier (états, transitions, effets de bord sur les données).
 * Aucune dépendance serveur : les routes API l'utilisent pour décider, l'interface peut la lire
 * (`allowedTransitions`) pour n'afficher que des actions réellement possibles.
 *
 * Les transitions « normales » (suivant / retour) sont lues dans `DOSSIER_PHASES`
 * (dossier-workflow.ts) : le serveur n'accepte que ce que l'écran du bureau propose.
 */

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "pending",
  "awaiting_document",
  "approved",
  "rejected",
  "cancelled",
];
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["unpaid", "partial", "paid"];
export const DOSSIER_PHASE_VALUES: readonly ApplicationDossierPhase[] = [
  "reception",
  "espace_validation",
  "documents",
  "payment",
  "finalized",
];
export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = [
  "cash",
  "check",
  "bank_transfer",
  "card",
  "other",
  "",
];
const APP_ROLE_VALUES: readonly AppRole[] = [
  "member",
  "coach",
  "president",
  "vice_president",
  "treasurer",
  "secretary",
];

const PHASE_INDEX: Record<ApplicationDossierPhase, number> = {
  reception: 0,
  espace_validation: 1,
  documents: 2,
  payment: 3,
  finalized: 4,
};

const HISTORY_LIMIT = 50;
const MAX_AMOUNT = 100_000;

/** Refus métier : `status` HTTP et message français affichable tel quel par l'interface. */
export class TransitionRejection extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 409, code?: string) {
    super(message);
    this.name = "TransitionRejection";
    this.status = status;
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Lecture de l'état                                                   */
/* ------------------------------------------------------------------ */

export type DossierStateKey =
  | "reception"
  | "espace_validation"
  | "documents"
  | "documents_requested"
  | "payment"
  | "finalized"
  | "rejected"
  | "cancelled"
  | "inconsistent";

type StateFields = Pick<RegistrationApplication, "status" | "paymentStatus" | "dossierPhase">;

export function isClosedApplication(app: Pick<RegistrationApplication, "status">): boolean {
  return app.status === "rejected" || app.status === "cancelled";
}

export function isFinalizedApplication(
  app: Pick<RegistrationApplication, "status" | "paymentStatus">,
): boolean {
  return app.status === "approved" && app.paymentStatus === "paid";
}

/**
 * Un paiement est enregistré (l'attestation reste valable) même si l'adhérent s'est ensuite
 * désinscrit ; un refus forcé, lui, annule le paiement (`paymentStatus` repasse à « unpaid »).
 */
export function hasRecordedPayment(app: Pick<RegistrationApplication, "status" | "paymentStatus">): boolean {
  return app.paymentStatus === "paid" && app.status !== "rejected";
}

export function dossierStateKey(app: StateFields): DossierStateKey {
  if (app.status === "rejected") return "rejected";
  if (app.status === "cancelled") return "cancelled";
  if (app.status === "awaiting_document") return "documents_requested";
  if (app.status === "approved") return app.paymentStatus === "paid" ? "finalized" : "payment";
  const phase = getApplicationDossierPhase(app as RegistrationApplication);
  if (phase === "reception" || phase === "espace_validation" || phase === "documents") return phase;
  return "inconsistent";
}

function currentStepLabel(app: RegistrationApplication): string {
  return PROCESSING_PHASE_LABELS[getDossierProcessingPhase(app)];
}

/* ------------------------------------------------------------------ */
/* Transitions autorisées                                              */
/* ------------------------------------------------------------------ */

export type PhaseTarget = {
  status: ApplicationStatus;
  dossierPhase: ApplicationDossierPhase;
  /** `null` : le paiement n'est pas modifié par la transition. */
  paymentStatus: PaymentStatus | null;
};

export type AllowedTransition = {
  id:
    | "next"
    | "back"
    | "validate_espace"
    | "request_document"
    | "reject"
    | "cancel"
    | "renew_license"
    | "resend_receipt";
  /** Route qui exécute la transition. */
  via: "patch" | "validate-espace" | "request-document" | "reject" | "renew-license" | "receipt";
  label: string;
  target?: PhaseTarget;
  /** Seul le président peut l'exécuter (et avec une confirmation explicite). */
  requiresPresident?: boolean;
};

function toTarget(payload: ApplicationUpdatePayload): PhaseTarget {
  return {
    status: payload.status ?? "pending",
    dossierPhase: payload.dossierPhase ?? "reception",
    paymentStatus: payload.paymentStatus ?? null,
  };
}

export function canRequestDocument(app: RegistrationApplication): boolean {
  if (isClosedApplication(app) || isFinalizedApplication(app)) return false;
  const phase = getApplicationDossierPhase(app);
  return phase === "documents" || phase === "payment";
}

/**
 * Transitions possibles depuis l'état actuel du dossier.
 *
 * | État actuel                    | Suivant                     | Retour                    | Autres                        |
 * | ------------------------------ | --------------------------- | ------------------------- | ----------------------------- |
 * | Réception                      | Espace (ou Paiement, papier)| —                         | désinscrire, refuser          |
 * | Espace adhérent                | Pièces (validate-espace)    | Réception                 | désinscrire, refuser          |
 * | Pièces                         | Paiement                    | Espace (ou Réception)     | pièce, désinscrire, refuser   |
 * | Pièce demandée (awaiting)      | — (dépôt ou retour d'abord) | Espace adhérent           | pièce, désinscrire, refuser   |
 * | Paiement                       | Finalisé (paiement reçu)    | Pièces (paiement impayé)  | pièce, désinscrire, refuser   |
 * | Finalisé                       | —                           | Paiement (annule le reçu) | renouveler, reçu, désinscrire, refus forcé (président) |
 * | Refusé / Désinscrit            | —                           | —                         | aucune (nouvelle pré-inscription) |
 */
export function allowedTransitions(app: RegistrationApplication): AllowedTransition[] {
  if (isClosedApplication(app)) return [];
  const key = dossierStateKey(app);
  const result: AllowedTransition[] = [];

  const next = getPhaseAction(app, "next");
  if (next && key !== "documents_requested") {
    if (next.kind === "validate_espace") {
      if (app.clerkUserId) {
        result.push({ id: "validate_espace", via: "validate-espace", label: next.label });
      }
    } else if (next.payload) {
      result.push({ id: "next", via: "patch", label: next.label, target: toTarget(next.payload) });
    }
  }

  const back = getPhaseAction(app, "back");
  if (back?.payload) {
    result.push({ id: "back", via: "patch", label: back.label, target: toTarget(back.payload) });
  }

  if (canRequestDocument(app)) {
    result.push({ id: "request_document", via: "request-document", label: "Demander une pièce" });
  }

  result.push({
    id: "cancel",
    via: "patch",
    label: "Désinscrire",
    target: { status: "cancelled", dossierPhase: getApplicationDossierPhase(app), paymentStatus: null },
  });
  result.push({
    id: "reject",
    via: "reject",
    label: "Refuser le dossier",
    requiresPresident: isFinalizedApplication(app),
  });

  if (isFinalizedApplication(app)) {
    result.push({ id: "renew_license", via: "renew-license", label: "Renouveler la licence" });
    result.push({ id: "resend_receipt", via: "receipt", label: "Renvoyer l’attestation" });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Lecture sûre du corps d'un PATCH                                    */
/* ------------------------------------------------------------------ */

function optionalString(raw: Record<string, unknown>, key: string, max: number): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new TransitionRejection("Requête invalide.", 400);
  }
  if (value.length > max) {
    throw new TransitionRejection("Un des champs est trop long.", 400);
  }
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new TransitionRejection(message, 400);
  }
  return value as T;
}

/** Parse un montant en euros (nombre ou texte « 12,50 »). `undefined` = non fourni. */
export function parseAmountField(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(/\s/g, "").replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AMOUNT) {
    throw new TransitionRejection("Le montant saisi n’est pas valide.", 400);
  }
  return Math.round(parsed * 100) / 100;
}

/** Valide et nettoie le corps d'un PATCH : champs inconnus ignorés, types et valeurs contrôlés. */
export function parseApplicationPatch(raw: unknown): ApplicationUpdatePayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TransitionRejection("Corps de requête invalide.", 400);
  }
  const body = raw as Record<string, unknown>;
  const patch: ApplicationUpdatePayload = {};

  patch.status = oneOf(body.status, APPLICATION_STATUSES, "Statut du dossier invalide.");
  patch.paymentStatus = oneOf(body.paymentStatus, PAYMENT_STATUSES, "Statut de paiement invalide.");
  patch.dossierPhase = oneOf(body.dossierPhase, DOSSIER_PHASE_VALUES, "Étape du dossier invalide.");
  patch.paymentMethod = oneOf(body.paymentMethod, PAYMENT_METHOD_VALUES, "Mode de paiement invalide.");
  patch.role = oneOf(body.role, APP_ROLE_VALUES, "Rôle invalide.");

  if (body.trialAttended !== undefined) {
    if (typeof body.trialAttended !== "boolean") throw new TransitionRejection("Requête invalide.", 400);
    patch.trialAttended = body.trialAttended;
  }
  patch.notes = optionalString(body, "notes", 5000);
  patch.memberMessage = optionalString(body, "memberMessage", 1000);
  patch.trialSlotId = optionalString(body, "trialSlotId", 120);

  if (body.licenseEndDate !== undefined) {
    if (body.licenseEndDate === null) {
      patch.licenseEndDate = null;
    } else if (
      typeof body.licenseEndDate === "string" &&
      isValidIsoDate(body.licenseEndDate) &&
      body.licenseEndDate >= "2000-01-01" &&
      body.licenseEndDate <= "2100-12-31"
    ) {
      patch.licenseEndDate = body.licenseEndDate;
    } else {
      throw new TransitionRejection("La date de fin de licence n’est pas valide.", 400);
    }
  }

  patch.amountPaid = parseAmountField(body.amountPaid);

  if (body.disciplineIds !== undefined) {
    if (
      !Array.isArray(body.disciplineIds) ||
      body.disciplineIds.length > 30 ||
      body.disciplineIds.some((id) => typeof id !== "string")
    ) {
      throw new TransitionRejection("Liste d’activités invalide.", 400);
    }
    patch.disciplineIds = body.disciplineIds as string[];
  }

  for (const key of [
    "firstName",
    "lastName",
    "fullName",
    "email",
    "phone",
    "address",
    "postalCode",
    "city",
  ] as const) {
    patch[key] = optionalString(body, key, 300);
  }

  for (const key of Object.keys(patch) as (keyof ApplicationUpdatePayload)[]) {
    if (patch[key] === undefined) delete patch[key];
  }
  return patch;
}

/* ------------------------------------------------------------------ */
/* Validation d'un PATCH                                               */
/* ------------------------------------------------------------------ */

export type PatchPlan = {
  kind: "none" | "same" | "advance" | "back" | "finalize" | "unfinalize" | "cancel";
  stateChanged: boolean;
  next: {
    status: ApplicationStatus;
    dossierPhase: ApplicationDossierPhase;
    paymentStatus: PaymentStatus;
    licenseEndDate: string | null;
  };
  finalizing: boolean;
  unfinalizing: boolean;
  cancelling: boolean;
  /** Le dossier passe à l'étape Paiement (e-mail « Paiement attendu »). */
  enteringPayment: boolean;
  /** Une demande de pièce en cours est abandonnée : ses liens doivent être invalidés. */
  leavingAwaitingDocument: boolean;
};

function sameState(
  app: RegistrationApplication,
  next: { status: ApplicationStatus; dossierPhase: ApplicationDossierPhase; paymentStatus: PaymentStatus },
): boolean {
  return (
    next.status === app.status &&
    next.paymentStatus === app.paymentStatus &&
    next.dossierPhase === getApplicationDossierPhase(app)
  );
}

function explainRefusal(
  app: RegistrationApplication,
  candidate: { status: ApplicationStatus; dossierPhase: ApplicationDossierPhase; paymentStatus: PaymentStatus },
): string {
  const key = dossierStateKey(app);
  const currentPhase = getApplicationDossierPhase(app);
  const movesForward = PHASE_INDEX[candidate.dossierPhase] > PHASE_INDEX[currentPhase];

  if (key === "documents_requested" && movesForward) {
    return "Une pièce est en attente de l’adhérent : le dossier reprendra dès son dépôt. Vous pouvez aussi ajouter la pièce vous-même (section « Pièces ») ou annuler la demande en revenant à l’étape précédente.";
  }
  if (candidate.status === "awaiting_document") {
    return "Pour demander une pièce, utilisez l’action « Demander une pièce à l’adhérent ».";
  }
  if (candidate.status === "rejected") {
    return "Pour refuser un dossier, utilisez l’action « Refuser ce dossier ».";
  }
  if (candidate.paymentStatus === "paid" || candidate.dossierPhase === "finalized") {
    if (key === "finalized") {
      return "Ce dossier est déjà finalisé : le paiement ne peut pas être enregistré une seconde fois.";
    }
    return "Le paiement ne peut être enregistré qu’à l’étape « Paiement », une fois les pièces vérifiées.";
  }
  if (
    candidate.dossierPhase === "documents" &&
    PHASE_INDEX[currentPhase] < PHASE_INDEX.documents &&
    !isClosedApplication(app)
  ) {
    return "Pour passer à l’étape suivante, utilisez l’action « Valider l’espace adhérent ».";
  }
  if (!movesForward && PHASE_INDEX[candidate.dossierPhase] < PHASE_INDEX[currentPhase] - 1) {
    return "Le dossier ne peut revenir en arrière que d’une étape à la fois.";
  }
  if (
    (candidate.status === "approved") !==
    (PHASE_INDEX[candidate.dossierPhase] >= PHASE_INDEX.payment)
  ) {
    return "Cette combinaison d’état et d’étape est incohérente : modification refusée.";
  }
  return `Ce changement d’étape n’est pas possible depuis l’étape actuelle (« ${currentStepLabel(app)} »).`;
}

/**
 * Vérifie une modification demandée par le bureau et calcule l'état résultant.
 * Ne modifie rien : `applyTransition` applique ensuite le plan. Lève `TransitionRejection`.
 */
export function validatePatch(
  app: RegistrationApplication,
  patch: ApplicationUpdatePayload,
  options: { now?: Date } = {},
): PatchPlan {
  const currentPhase = getApplicationDossierPhase(app);
  const current = {
    status: app.status,
    dossierPhase: currentPhase,
    paymentStatus: app.paymentStatus,
    licenseEndDate: app.licenseEndDate ?? null,
  };
  const touchesState =
    patch.status !== undefined ||
    patch.dossierPhase !== undefined ||
    patch.paymentStatus !== undefined ||
    patch.licenseEndDate !== undefined;

  const none: PatchPlan = {
    kind: "none",
    stateChanged: false,
    next: current,
    finalizing: false,
    unfinalizing: false,
    cancelling: false,
    enteringPayment: false,
    leavingAwaitingDocument: false,
  };
  if (!touchesState) return none;

  // Dérivation historique : un corps qui ne précise ni étape ni paiement complet reste cohérent.
  const status = patch.status ?? app.status;
  const paymentStatus = patch.paymentStatus ?? app.paymentStatus;
  let dossierPhase = patch.dossierPhase ?? currentPhase;
  if (patch.dossierPhase === undefined && (patch.status !== undefined || patch.paymentStatus !== undefined)) {
    if (status === "approved") dossierPhase = paymentStatus === "paid" ? "finalized" : "payment";
  }
  const candidate = { status, dossierPhase, paymentStatus };
  const now = options.now ?? new Date();

  if (isClosedApplication(app)) {
    if (sameState(app, candidate) && patch.licenseEndDate === undefined) return { ...none, kind: "same" };
    throw new TransitionRejection(
      "Ce dossier est clos (refusé ou désinscrit) : son état ne peut plus être modifié. Pour une réinscription, la personne doit déposer une nouvelle pré-inscription.",
      409,
      "dossier_closed",
    );
  }

  /* Désinscription : possible depuis n'importe quel dossier ouvert. */
  if (status === "cancelled") {
    if (
      (patch.dossierPhase !== undefined && patch.dossierPhase !== currentPhase) ||
      (patch.paymentStatus !== undefined && patch.paymentStatus !== app.paymentStatus) ||
      (patch.licenseEndDate !== undefined && patch.licenseEndDate !== null)
    ) {
      throw new TransitionRejection(
        "Une désinscription ne peut pas modifier l’étape, le paiement ou la licence.",
        409,
      );
    }
    return {
      kind: "cancel",
      stateChanged: true,
      next: { status: "cancelled", dossierPhase: currentPhase, paymentStatus: app.paymentStatus, licenseEndDate: null },
      finalizing: false,
      unfinalizing: false,
      cancelling: true,
      enteringPayment: false,
      leavingAwaitingDocument: app.status === "awaiting_document",
    };
  }

  /* Même état : opération sans effet (jamais de second reçu), la date de licence reste modifiable. */
  if (sameState(app, candidate)) {
    let licenseEndDate = current.licenseEndDate;
    if (patch.licenseEndDate !== undefined) {
      if (!isFinalizedApplication(app) && patch.licenseEndDate !== null) {
        throw new TransitionRejection(
          "La date de fin de licence ne peut être définie que sur un dossier finalisé.",
          409,
        );
      }
      licenseEndDate = patch.licenseEndDate;
    }
    return { ...none, kind: "same", next: { ...current, licenseEndDate } };
  }

  const matching = allowedTransitions(app).find(
    (transition) =>
      transition.via === "patch" &&
      transition.target &&
      transition.id !== "cancel" &&
      transition.target.status === candidate.status &&
      transition.target.dossierPhase === candidate.dossierPhase &&
      (transition.target.paymentStatus ?? app.paymentStatus) === candidate.paymentStatus,
  );
  if (!matching) {
    throw new TransitionRejection(explainRefusal(app, candidate), 409, "transition_refused");
  }

  const finalizing = candidate.status === "approved" && candidate.paymentStatus === "paid" && !isFinalizedApplication(app);
  const unfinalizing = isFinalizedApplication(app) && !(candidate.status === "approved" && candidate.paymentStatus === "paid");

  if (finalizing) {
    const method = patch.paymentMethod !== undefined ? patch.paymentMethod : app.paymentMethod;
    if (!method) {
      throw new TransitionRejection("Choisissez le mode de paiement reçu avant de finaliser.", 400, "payment_method_required");
    }
  }

  let licenseEndDate: string | null = null;
  if (candidate.dossierPhase === "finalized") {
    licenseEndDate =
      patch.licenseEndDate ?? app.licenseEndDate ?? nextLicenseEndDate(null, todayParisIso(now));
  } else if (patch.licenseEndDate !== undefined && patch.licenseEndDate !== null) {
    throw new TransitionRejection(
      "La date de fin de licence ne peut être définie que sur un dossier finalisé.",
      409,
    );
  }

  return {
    kind: finalizing
      ? "finalize"
      : unfinalizing
        ? "unfinalize"
        : matching.id === "back"
          ? "back"
          : "advance",
    stateChanged: true,
    next: { ...candidate, licenseEndDate },
    finalizing,
    unfinalizing,
    cancelling: false,
    enteringPayment: candidate.dossierPhase === "payment" && currentPhase !== "payment" && !unfinalizing,
    leavingAwaitingDocument: app.status === "awaiting_document",
  };
}

/* ------------------------------------------------------------------ */
/* Historique, reçus, jetons                                           */
/* ------------------------------------------------------------------ */

export type TransitionContext = {
  /** Nom affiché dans l'historique (utilisateur connecté). */
  actor: string;
  now?: Date;
};

export function pushHistory(
  app: RegistrationApplication,
  entry: { by: string; action: string; from?: string; to?: string; note?: string },
  now: Date = new Date(),
): void {
  const history = [...(app.history ?? []), { at: now.toISOString(), ...entry }];
  app.history = history.slice(-HISTORY_LIMIT);
}

function describeState(state: {
  status: ApplicationStatus;
  dossierPhase: ApplicationDossierPhase;
  paymentStatus: PaymentStatus;
}): string {
  return `${state.status}/${state.dossierPhase}/${state.paymentStatus}`;
}

function parisYear(date: Date): string {
  return todayParisIso(date).slice(0, 4);
}

/** Prochain numéro d'attestation « AAAA-NNNN » : maximum de l'année + 1, numéros annulés compris. */
export function nextReceiptNumber(
  applications: readonly RegistrationApplication[],
  at: Date = new Date(),
): string {
  const year = parisYear(at);
  let max = 0;
  const consider = (value: string | null | undefined) => {
    const match = value ? /^(\d{4})-(\d+)$/.exec(value) : null;
    if (match && match[1] === year) max = Math.max(max, Number(match[2]));
  };
  for (const application of applications) {
    consider(application.receiptNumber);
    for (const entry of application.receiptHistory ?? []) consider(entry.number);
  }
  return `${year}-${String(max + 1).padStart(4, "0")}`;
}

/** Montant à inscrire sur l'attestation : saisie du bureau, sinon montant déjà noté, sinon total du bulletin. */
export function resolveAmountPaid(
  app: Pick<RegistrationApplication, "amountPaid" | "membershipBulletin">,
  enteredAmount?: number | null,
): number | null {
  if (typeof enteredAmount === "number") return enteredAmount;
  if (typeof app.amountPaid === "number" && Number.isFinite(app.amountPaid)) return app.amountPaid;
  const total = app.membershipBulletin?.grandTotal;
  return typeof total === "number" && total > 0 ? total : null;
}

function archiveReceipt(
  app: RegistrationApplication,
  reason: ReceiptHistoryEntry["reason"],
  now: Date,
): void {
  if (!app.receiptNumber && !app.paidAt) return;
  app.receiptHistory = [
    ...(app.receiptHistory ?? []),
    {
      number: app.receiptNumber ?? null,
      paidAt: app.paidAt ?? null,
      amountPaid: typeof app.amountPaid === "number" ? app.amountPaid : null,
      paymentMethod: app.paymentMethod,
      licenseEndDate: app.licenseEndDate ?? null,
      closedAt: now.toISOString(),
      reason,
    },
  ].slice(-HISTORY_LIMIT);
}

function clearPaymentRecord(app: RegistrationApplication): void {
  app.paidAt = null;
  app.receiptNumber = null;
  app.receiptSentAt = null;
  if (app.origin !== "paper") app.amountPaid = null;
}

/**
 * Enregistre un paiement : date, numéro d'attestation stable, montant. Le reçu n'est pas
 * encore envoyé (`receiptSentAt` vide) : l'envoi se fait une fois les données sauvegardées.
 */
export function recordPayment(
  applications: readonly RegistrationApplication[],
  app: RegistrationApplication,
  input: { paymentMethod?: PaymentMethod; amountPaid?: number | null; now?: Date },
): void {
  const now = input.now ?? new Date();
  if (input.paymentMethod) app.paymentMethod = input.paymentMethod;
  app.paidAt = now.toISOString();
  app.receiptNumber = nextReceiptNumber(applications, now);
  app.amountPaid = resolveAmountPaid(app, input.amountPaid);
  app.receiptSentAt = null;
}

/**
 * Dossier payé avant l'introduction de la date et du numéro (ou créé par le bureau en papier) :
 * fixe une fois pour toutes ces valeurs, au lieu de les recalculer à chaque téléchargement.
 * Renvoie `true` si le dossier a été complété.
 */
export function ensureReceiptRecord(
  applications: readonly RegistrationApplication[],
  app: RegistrationApplication,
  now: Date = new Date(),
): boolean {
  if (!hasRecordedPayment(app)) return false;
  let changed = false;
  if (!app.paidAt) {
    app.paidAt = now.toISOString();
    changed = true;
  }
  if (!app.receiptNumber) {
    app.receiptNumber = nextReceiptNumber(applications, new Date(app.paidAt));
    changed = true;
  }
  if (typeof app.amountPaid !== "number") {
    const amount = resolveAmountPaid(app);
    if (amount !== null) {
      app.amountPaid = amount;
      changed = true;
    }
  }
  return changed;
}

export function revokeDocumentTokens(data: ClubData, applicationId: string, now: Date = new Date()): number {
  let revoked = 0;
  for (const entry of data.documentRequestTokens) {
    if (entry.applicationId === applicationId && !entry.usedAt) {
      entry.usedAt = now.toISOString();
      entry.revokedAt = now.toISOString();
      revoked += 1;
    }
  }
  return revoked;
}

/* ------------------------------------------------------------------ */
/* Application d'un PATCH                                              */
/* ------------------------------------------------------------------ */

/** Applique un plan produit par `validatePatch` (à appeler dans `updateClubData`). */
export function applyTransition(
  data: ClubData,
  app: RegistrationApplication,
  plan: PatchPlan,
  patch: ApplicationUpdatePayload,
  context: TransitionContext,
): void {
  const now = context.now ?? new Date();
  if (plan.kind === "none") return;

  const before = {
    status: app.status,
    dossierPhase: getApplicationDossierPhase(app),
    paymentStatus: app.paymentStatus,
  };
  const previousLicenseEnd = app.licenseEndDate ?? null;

  if (plan.unfinalizing) {
    archiveReceipt(app, "unfinalized", now);
  }

  app.status = plan.next.status;
  app.dossierPhase = plan.next.dossierPhase;
  app.paymentStatus = plan.next.paymentStatus;
  app.licenseEndDate = plan.next.licenseEndDate;

  if (plan.unfinalizing) {
    clearPaymentRecord(app);
  }
  if (plan.finalizing) {
    recordPayment(data.applications, app, {
      paymentMethod: patch.paymentMethod,
      amountPaid: patch.amountPaid,
      now,
    });
  }
  if (plan.leavingAwaitingDocument) {
    revokeDocumentTokens(data, app.id, now);
  }

  if (plan.stateChanged) {
    const notes: string[] = [];
    if (previousLicenseEnd && !plan.next.licenseEndDate) {
      notes.push(`fin de licence ${previousLicenseEnd} retirée`);
    }
    if (plan.unfinalizing) notes.push("paiement et attestation annulés");
    if (plan.finalizing) notes.push(`attestation ${app.receiptNumber ?? ""}`.trim());
    pushHistory(
      app,
      {
        by: context.actor,
        action: plan.kind,
        from: describeState(before),
        to: describeState({
          status: app.status,
          dossierPhase: getApplicationDossierPhase(app),
          paymentStatus: app.paymentStatus,
        }),
        note: notes.join(" ; ") || undefined,
      },
      now,
    );
  } else if (plan.kind === "same" && previousLicenseEnd !== plan.next.licenseEndDate) {
    pushHistory(
      app,
      {
        by: context.actor,
        action: "license_end_changed",
        note: `${previousLicenseEnd ?? "—"} → ${plan.next.licenseEndDate ?? "—"}`,
      },
      now,
    );
    app.licenseEndDate = plan.next.licenseEndDate;
  }
}

/* ------------------------------------------------------------------ */
/* Validation de l'espace adhérent                                     */
/* ------------------------------------------------------------------ */

/** « validate » : ouvre l'espace ; « already » : déjà ouvert, on ne fait que resynchroniser le compte. */
export function planEspaceValidation(app: RegistrationApplication): "validate" | "already" {
  if (isClosedApplication(app)) {
    throw new TransitionRejection(
      "Ce dossier est clos (refusé ou désinscrit) : l’espace adhérent ne peut pas être validé.",
      409,
      "dossier_closed",
    );
  }
  if (!app.clerkUserId) {
    throw new TransitionRejection("Aucun compte de connexion n’est lié à ce dossier.", 400);
  }
  const phase = getApplicationDossierPhase(app);
  if (app.status === "pending" && (phase === "reception" || phase === "espace_validation")) {
    return "validate";
  }
  if ((app.status === "pending" || app.status === "awaiting_document") && phase === "documents") {
    return "already";
  }
  throw new TransitionRejection(
    "Ce dossier est déjà plus avancé : l’espace adhérent a déjà été validé.",
    409,
    "already_advanced",
  );
}

export function applyEspaceValidation(app: RegistrationApplication, context: TransitionContext): void {
  const now = context.now ?? new Date();
  const before = describeState({
    status: app.status,
    dossierPhase: getApplicationDossierPhase(app),
    paymentStatus: app.paymentStatus,
  });
  app.dossierPhase = "documents";
  app.status = "pending";
  pushHistory(
    app,
    {
      by: context.actor,
      action: "validate_espace",
      from: before,
      to: describeState({ status: "pending", dossierPhase: "documents", paymentStatus: app.paymentStatus }),
    },
    now,
  );
}

/* ------------------------------------------------------------------ */
/* Demande de pièce                                                    */
/* ------------------------------------------------------------------ */

export const DOCUMENT_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function planDocumentRequest(app: RegistrationApplication): void {
  if (isClosedApplication(app)) {
    throw new TransitionRejection(
      "Ce dossier est clos (refusé ou désinscrit) : aucune pièce ne peut être demandée.",
      409,
      "dossier_closed",
    );
  }
  if (isFinalizedApplication(app)) {
    throw new TransitionRejection(
      "Ce dossier est finalisé : revenez d’abord à l’étape « Paiement » pour demander une pièce.",
      409,
    );
  }
  if (!canRequestDocument(app) && app.status !== "awaiting_document") {
    throw new TransitionRejection(
      "Une pièce ne peut être demandée qu’à partir de l’étape « Pièces à vérifier ».",
      409,
    );
  }
}

/** État à retrouver une fois la pièce déposée : celui d'avant la PREMIÈRE demande en cours. */
function currentResumeState(
  data: ClubData,
  app: RegistrationApplication,
): NonNullable<DocumentRequestToken["resumeAfterUpload"]> {
  if (app.status === "awaiting_document") {
    const earlier = data.documentRequestTokens
      .filter(
        (entry) =>
          entry.applicationId === app.id &&
          !entry.usedAt &&
          entry.resumeAfterUpload &&
          entry.resumeAfterUpload.status !== "awaiting_document",
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (earlier?.resumeAfterUpload) return earlier.resumeAfterUpload;
    return { status: "pending", dossierPhase: "documents", paymentStatus: app.paymentStatus };
  }
  return {
    status: app.status,
    dossierPhase: getApplicationDossierPhase(app),
    paymentStatus: app.paymentStatus,
  };
}

function createDocumentToken(
  data: ClubData,
  app: RegistrationApplication,
  label: string,
  resume: NonNullable<DocumentRequestToken["resumeAfterUpload"]>,
  now: Date,
): DocumentRequestToken {
  revokeDocumentTokens(data, app.id, now);
  const token: DocumentRequestToken = {
    token: `doc_${secureToken()}`,
    applicationId: app.id,
    email: app.email.trim(),
    requestedDocumentLabel: label,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DOCUMENT_TOKEN_TTL_MS).toISOString(),
    usedAt: null,
    revokedAt: null,
    resumeAfterUpload: resume,
  };
  data.documentRequestTokens.push(token);
  return token;
}

/** Passe le dossier en « pièce demandée » et émet un lien neuf (les anciens liens sont invalidés). */
export function applyDocumentRequest(
  data: ClubData,
  app: RegistrationApplication,
  input: { label: string },
  context: TransitionContext,
): DocumentRequestToken {
  planDocumentRequest(app);
  const now = context.now ?? new Date();
  const resume = currentResumeState(data, app);
  const wasAwaiting = app.status === "awaiting_document";
  const token = createDocumentToken(data, app, input.label, resume, now);
  app.status = "awaiting_document";
  app.dossierPhase = "documents";
  pushHistory(
    app,
    {
      by: context.actor,
      action: wasAwaiting ? "document_request_renewed" : "document_request",
      note: input.label,
    },
    now,
  );
  return token;
}

/** Nouveau lien demandé par l'adhérent lui-même : même pièce, même état à retrouver. */
export function reissueDocumentToken(
  data: ClubData,
  app: RegistrationApplication,
  now: Date = new Date(),
): DocumentRequestToken {
  if (app.status !== "awaiting_document") {
    throw new TransitionRejection("Aucune pièce n’est actuellement demandée sur ce dossier.", 409);
  }
  if (!app.email?.trim()) {
    throw new TransitionRejection("Aucune adresse e-mail n’est enregistrée sur ce dossier.", 400);
  }
  const previous = data.documentRequestTokens
    .filter((entry) => entry.applicationId === app.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const label = previous?.requestedDocumentLabel?.trim() || "pièce justificative";
  const resume = currentResumeState(data, app);
  const token = createDocumentToken(data, app, label, resume, now);
  pushHistory(app, { by: "adhérent", action: "document_link_reissued", note: label }, now);
  return token;
}

/**
 * Restaure le dossier après le dépôt d'une pièce par l'adhérent (lien public).
 * Ne touche jamais au paiement ; n'agit que si une pièce était réellement demandée.
 */
export function applyDocumentUploadResume(
  app: RegistrationApplication,
  tokenEntry: Pick<DocumentRequestToken, "resumeAfterUpload">,
): boolean {
  if (app.status !== "awaiting_document") return false;
  const resume = tokenEntry.resumeAfterUpload;
  const status =
    resume && resume.status !== "awaiting_document" && resume.status !== "rejected" && resume.status !== "cancelled"
      ? resume.status
      : "pending";
  let phase = resume?.dossierPhase ?? "documents";
  if (phase === "finalized" && app.paymentStatus !== "paid") phase = "payment";
  if (status === "pending" && phase === "payment") phase = "documents";
  if (status === "approved" && phase !== "payment" && app.paymentStatus !== "paid") phase = "payment";
  app.status = status;
  app.dossierPhase = phase;
  return true;
}

/**
 * Pièce ajoutée par le bureau : si une demande était en cours, elle est close et le dossier reprend
 * son état d'avant la demande. Ne modifie jamais l'étape autrement.
 */
export function applyDocumentAddedByStaff(
  data: ClubData,
  app: RegistrationApplication,
  document: RegistrationApplication["documents"][number],
  context: TransitionContext,
): { resumed: boolean } {
  const now = context.now ?? new Date();
  if (isClosedApplication(app)) {
    throw new TransitionRejection(
      "Ce dossier est clos (refusé ou désinscrit) : aucune pièce ne peut être ajoutée.",
      409,
      "dossier_closed",
    );
  }
  app.documents.push(document);
  let resumed = false;
  if (app.status === "awaiting_document") {
    const resume = currentResumeState(data, app);
    revokeDocumentTokens(data, app.id, now);
    resumed = applyDocumentUploadResume(app, { resumeAfterUpload: resume });
  }
  pushHistory(
    app,
    { by: context.actor, action: "document_added", note: document.name, ...(resumed ? { to: "reprise" } : {}) },
    now,
  );
  return { resumed };
}

/* ------------------------------------------------------------------ */
/* Refus                                                               */
/* ------------------------------------------------------------------ */

/** « retry » : dossier déjà refusé dont le compte de connexion reste à supprimer. */
export function planReject(
  app: RegistrationApplication,
  options: { force: boolean; actorIsPresident: boolean },
): "reject" | "retry" {
  if (app.status === "rejected") {
    if (app.clerkUserId) return "retry";
    throw new TransitionRejection("Ce dossier est déjà refusé.", 409, "already_rejected");
  }
  if (app.status === "cancelled") {
    throw new TransitionRejection(
      "Cet adhérent est désinscrit : son dossier est déjà clos. Il n’y a rien à refuser.",
      409,
      "dossier_closed",
    );
  }
  if (isFinalizedApplication(app)) {
    if (!options.force) {
      throw new TransitionRejection(
        "Ce dossier est finalisé et payé : le refuser annulerait une inscription déjà réglée. Cette action est réservée au président et demande une confirmation explicite.",
        409,
        "finalized_requires_force",
      );
    }
    if (!options.actorIsPresident) {
      throw new TransitionRejection(
        "Seul le président peut refuser un dossier finalisé et payé.",
        403,
        "finalized_requires_president",
      );
    }
  }
  return "reject";
}

/**
 * Refus : le dossier est clos. Pour un dossier finalisé (refus forcé par le président), le paiement
 * est annulé — attestation archivée, fin de licence retirée, statut « non payé » ; un éventuel
 * remboursement se traite hors de l'application.
 */
export function applyReject(
  data: ClubData,
  app: RegistrationApplication,
  input: { reason: string; force: boolean },
  context: TransitionContext,
): { paymentCancelled: boolean } {
  const now = context.now ?? new Date();
  const before = describeState({
    status: app.status,
    dossierPhase: getApplicationDossierPhase(app),
    paymentStatus: app.paymentStatus,
  });
  const wasFinalized = isFinalizedApplication(app);
  if (wasFinalized) {
    archiveReceipt(app, "rejected", now);
    clearPaymentRecord(app);
    app.paymentStatus = "unpaid";
  }
  app.status = "rejected";
  app.dossierPhase = "reception";
  app.licenseEndDate = null;
  app.rejectionReason = input.reason;
  revokeDocumentTokens(data, app.id, now);
  pushHistory(
    app,
    {
      by: context.actor,
      action: input.force && wasFinalized ? "reject_forced" : "reject",
      from: before,
      to: describeState({ status: "rejected", dossierPhase: "reception", paymentStatus: app.paymentStatus }),
      note: wasFinalized ? "paiement annulé (remboursement éventuel à traiter hors application)" : input.reason || undefined,
    },
    now,
  );
  return { paymentCancelled: wasFinalized };
}

/* ------------------------------------------------------------------ */
/* Renouvellement de licence                                           */
/* ------------------------------------------------------------------ */

/**
 * Renouvelle une licence payée : nouvelle attestation (l'ancienne est archivée) et nouvelle fin de
 * licence. `expectedLicenseEndDate` (date vue par le bureau) rend l'opération idempotente : un
 * second envoi du même renouvellement trouve une date différente et est refusé.
 */
export function applyLicenseRenewal(
  data: ClubData,
  app: RegistrationApplication,
  input: {
    expectedLicenseEndDate: string | null;
    paymentMethod: PaymentMethod;
    amountPaid?: number | null;
  },
  context: TransitionContext,
): { licenseEndDate: string } {
  const now = context.now ?? new Date();
  if (isClosedApplication(app)) {
    throw new TransitionRejection(
      "Ce dossier est clos (refusé ou désinscrit) : la licence ne peut pas être renouvelée.",
      409,
      "dossier_closed",
    );
  }
  if (!isFinalizedApplication(app)) {
    throw new TransitionRejection(
      "Seule la licence d’un dossier finalisé peut être renouvelée.",
      409,
    );
  }
  if (!input.paymentMethod) {
    throw new TransitionRejection("Choisissez le mode de paiement reçu.", 400, "payment_method_required");
  }
  if ((app.licenseEndDate ?? null) !== (input.expectedLicenseEndDate ?? null)) {
    throw new TransitionRejection(
      "Cette licence vient déjà d’être renouvelée ou modifiée. Rechargez la page pour voir sa date de fin actuelle.",
      409,
      "license_changed",
    );
  }

  const previousEnd = app.licenseEndDate ?? null;
  archiveReceipt(app, "renewed", now);
  const licenseEndDate = nextLicenseEndDate(previousEnd, todayParisIso(now));
  app.licenseEndDate = licenseEndDate;
  recordPayment(data.applications, app, {
    paymentMethod: input.paymentMethod,
    amountPaid: input.amountPaid,
    now,
  });
  pushHistory(
    app,
    {
      by: context.actor,
      action: "license_renewed",
      note: `${previousEnd ?? "—"} → ${licenseEndDate} ; attestation ${app.receiptNumber ?? ""}`.trim(),
    },
    now,
  );
  return { licenseEndDate };
}
