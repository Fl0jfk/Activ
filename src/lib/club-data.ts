import { getApplicationDossierPhase } from "@/lib/dossier-workflow";
import type { MembershipBulletinData } from "@/lib/membership-bulletin";
import type { AppRole } from "@/lib/roles";
import { normalizeAppRole } from "@/lib/roles";
import {
  isS3Configured,
  isS3NotFoundError,
  readJsonFromS3,
  readLocalJsonFile,
  writeJsonToS3,
} from "@/lib/s3-client";
import {
  buildMembershipActivityCatalog,
  repairApplicationDisciplines,
} from "@/lib/membership-activities";
import { readSiteData } from "@/lib/site-data";

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type ApplicationStatus = "pending" | "awaiting_document" | "approved" | "rejected" | "cancelled";
export type ApplicationDossierPhase =
  | "reception"
  | "espace_validation"
  | "documents"
  | "payment"
  | "finalized";
export type PaymentMethod = "cash" | "check" | "bank_transfer" | "card" | "other" | "";

export type ClubMemberRole = AppRole;

export type ClubMember = {
  clerkUserId: string;
  fullName: string;
  email: string;
  role: ClubMemberRole;
  functions: string[];
  membershipStatus: "pending" | "approved" | "rejected";
  updatedAt: string;
};

export type CoachAbsenceRequestStatus = "pending" | "approved" | "rejected";

export type CoachAbsenceRequest = {
  id: string;
  clerkUserId: string;
  coachName: string;
  disciplineId: string;
  scheduleSlotId: string;
  sessionDate: string;
  reason: string;
  status: CoachAbsenceRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
};

export type MemberRequestStatus = "received" | "in_progress" | "treated";

export type MemberRequestDocument = {
  name: string;
  url: string;
  uploadedAt: string;
};

/** Demande générique d’un adhérent au bureau. */
export type MemberRequest = {
  id: string;
  clerkUserId: string;
  memberName: string;
  memberEmail: string;
  subject: string;
  message: string;
  attachment: MemberRequestDocument | null;
  status: MemberRequestStatus;
  createdAt: string;
  startedAt?: string;
  startedByUserId?: string;
  treatedAt?: string;
  treatedByUserId?: string;
  bureauReply?: string;
  bureauAttachment?: MemberRequestDocument | null;
};

export type MemberContactChangeStatus = "pending" | "approved" | "rejected";

/** Demande de modification des coordonnées d’un adhérent, validée par le bureau. */
export type MemberContactChangeRequest = {
  id: string;
  applicationId: string;
  clerkUserId: string | null;
  status: MemberContactChangeStatus;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string;
};

export type TrialSlot = {
  id: string;
  disciplineId: string;
  title: string;
  startsAt: string;
  capacity: number;
  active: boolean;
};

/** E-mails de suivi envoyés à l'adhérent au fil du dossier (un seul envoi par type). */
export type LifecycleEmailKind =
  | "espace_activated"
  | "payment_expected"
  | "finalized"
  | "rejected"
  | "cancelled";

/** Trace d'une opération sensible sur un dossier (étapes, annulation d'un paiement…). */
export type DossierHistoryEntry = {
  at: string;
  by: string;
  action: string;
  from?: string;
  to?: string;
  note?: string;
};

/** Reçu annulé (retour en arrière, renouvellement, refus forcé) : le numéro n'est jamais réutilisé. */
export type ReceiptHistoryEntry = {
  number: string | null;
  paidAt: string | null;
  amountPaid: number | null;
  paymentMethod: PaymentMethod;
  licenseEndDate: string | null;
  closedAt: string;
  reason: "unfinalized" | "renewed" | "rejected";
};

export type RegistrationApplication = {
  id: string;
  clerkUserId: string | null;
  fullName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  documents: { name: string; url: string; uploadedAt: string }[];
  requestKind: "trial_and_preregistration" | "trial_only";
  disciplineId: string;
  /** Toutes les activités d'un bulletin (la première reste `disciplineId`). */
  disciplineIds?: string[];
  /** Dossier saisi au bureau pour un adhérent papier, sans compte Clerk. */
  origin?: "online" | "paper";
  /** Date à laquelle le bulletin papier signé a été réceptionné. */
  signedBulletinReceivedAt?: string | null;
  /** Montant encaissé saisi manuellement (adhérent papier). */
  amountPaid?: number | null;
  trialSlotId: string | null;
  motivation: string;
  createdAt: string;
  status: ApplicationStatus;
  dossierPhase?: ApplicationDossierPhase;
  trialAttended: boolean;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  licenseEndDate: string | null;
  notes: string;
  membershipBulletin?: MembershipBulletinData | null;
  /** Date de confirmation de l'adresse e-mail lors de l'inscription. */
  emailVerifiedAt?: string | null;
  /** Activités corrigées à la main par le bureau : ne plus les recalculer depuis le bulletin. */
  disciplinesSetByBureau?: boolean;
  /** Date (ISO) de l'enregistrement du paiement, fixée à la finalisation. */
  paidAt?: string | null;
  /** Numéro d'attestation stable (AAAA-NNNN), attribué à la finalisation. */
  receiptNumber?: string | null;
  /** Date (ISO) d'envoi réussi de l'attestation à l'adhérent. */
  receiptSentAt?: string | null;
  receiptHistory?: ReceiptHistoryEntry[];
  /** Message du bureau destiné à l'adhérent (les `notes` restent internes au bureau). */
  memberMessage?: string;
  /** Motif du refus, saisi par le bureau et communiqué à l'adhérent. */
  rejectionReason?: string;
  /** Date d'envoi des e-mails de suivi, pour ne jamais les envoyer deux fois. */
  lifecycleNotified?: Partial<Record<LifecycleEmailKind, string>>;
  history?: DossierHistoryEntry[];
};

/** Code envoyé par e-mail pour prouver que l'adresse existe avant création du compte. */
export type EmailVerificationCode = {
  id: string;
  email: string;
  codeHash: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  consumedAt: string | null;
};

export type DocumentRequestToken = {
  token: string;
  applicationId: string;
  email: string;
  requestedDocumentLabel: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  /** Jeton remplacé ou annulé par le bureau (il est alors aussi marqué comme utilisé). */
  revokedAt?: string | null;
  /**
   * État à restaurer après le dépôt. `paymentStatus` est conservé pour compatibilité mais ne doit
   * plus être réappliqué : le paiement n'est jamais modifié par un dépôt de pièce.
   */
  resumeAfterUpload?: {
    status: ApplicationStatus;
    dossierPhase: ApplicationDossierPhase;
    paymentStatus: PaymentStatus;
  };
};

export type BulletinRevalidationToken = {
  token: string;
  applicationId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type ClubData = {
  members: ClubMember[];
  trialSlots: TrialSlot[];
  applications: RegistrationApplication[];
  documentRequestTokens: DocumentRequestToken[];
  bulletinRevalidationTokens: BulletinRevalidationToken[];
  coachAbsenceRequests: CoachAbsenceRequest[];
  memberRequests: MemberRequest[];
  contactChangeRequests: MemberContactChangeRequest[];
  emailVerificationCodes: EmailVerificationCode[];
  updatedAt: string;
};

const defaultClubDataPath = `${process.cwd()}/data/club-data.json`;
const defaultClubDataKey = "data/club-data.json";

function normalizeClubData(data: ClubData): ClubData {
  return {
    members: (data.members ?? []).map((member) => ({
      ...member,
      role: normalizeAppRole(member.role) ?? "member",
    })),
    trialSlots: data.trialSlots ?? [],
    applications: (data.applications ?? []).map((application) => ({
      ...application,
      requestKind: application.requestKind ?? "trial_and_preregistration",
      firstName: application.firstName ?? "",
      lastName: application.lastName ?? "",
      phone: application.phone ?? "",
      address: application.address ?? "",
      postalCode: application.postalCode ?? "",
      city: application.city ?? "",
      documents: application.documents ?? [],
      disciplineIds:
        Array.isArray(application.disciplineIds) && application.disciplineIds.length > 0
          ? application.disciplineIds
          : application.disciplineId
            ? [application.disciplineId]
            : [],
      origin: application.origin ?? "online",
      signedBulletinReceivedAt: application.signedBulletinReceivedAt ?? null,
      amountPaid:
        typeof application.amountPaid === "number" && Number.isFinite(application.amountPaid)
          ? application.amountPaid
          : null,
      trialSlotId: application.trialSlotId ?? null,
      paymentMethod: application.paymentMethod ?? "",
      licenseEndDate: application.licenseEndDate ?? null,
      dossierPhase: getApplicationDossierPhase(application),
      membershipBulletin: application.membershipBulletin ?? null,
      emailVerifiedAt: application.emailVerifiedAt ?? null,
      paidAt: application.paidAt ?? null,
      receiptNumber: application.receiptNumber ?? null,
      receiptSentAt: application.receiptSentAt ?? null,
    })),
    documentRequestTokens: data.documentRequestTokens ?? [],
    bulletinRevalidationTokens: data.bulletinRevalidationTokens ?? [],
    coachAbsenceRequests: data.coachAbsenceRequests ?? [],
    memberRequests: (data.memberRequests ?? []).map((request) => ({
      ...request,
      attachment: request.attachment ?? null,
      bureauAttachment: request.bureauAttachment ?? null,
      bureauReply: request.bureauReply ?? "",
    })),
    contactChangeRequests: (data.contactChangeRequests ?? []).map((request) => ({
      ...request,
      status:
        request.status === "approved" || request.status === "rejected"
          ? request.status
          : "pending",
      firstName: request.firstName ?? "",
      lastName: request.lastName ?? "",
      email: request.email ?? "",
      phone: request.phone ?? "",
      address: request.address ?? "",
      postalCode: request.postalCode ?? "",
      city: request.city ?? "",
      reviewedAt: request.reviewedAt ?? null,
      reviewedBy: request.reviewedBy ?? null,
      rejectionReason: request.rejectionReason ?? "",
    })),
    emailVerificationCodes: (data.emailVerificationCodes ?? []).map((entry) => ({
      ...entry,
      email: entry.email?.trim().toLowerCase() ?? "",
      attempts: typeof entry.attempts === "number" ? entry.attempts : 0,
      verifiedAt: entry.verifiedAt ?? null,
      consumedAt: entry.consumedAt ?? null,
    })),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

function clubDataKey(): string {
  return process.env.CLUB_DATA_KEY || defaultClubDataKey;
}

/** Remet les activités de chaque dossier en accord avec son bulletin (voir `repairApplicationDisciplines`). */
async function repairDisciplines(data: ClubData): Promise<ClubData> {
  try {
    const siteData = await readSiteData();
    const catalog = buildMembershipActivityCatalog(siteData);
    for (const application of data.applications) {
      repairApplicationDisciplines(application, catalog);
    }
  } catch (error) {
    console.error("repairDisciplines: unable to read site data", error);
  }
  return data;
}

/**
 * Lit les données du club. Le fichier d'exemple n'est utilisé (et écrit) que si l'objet S3 n'existe pas
 * encore : une panne réseau ou un JSON invalide remonte en erreur au lieu d'écraser les vraies données.
 */
export async function readClubData(): Promise<ClubData> {
  if (!isS3Configured()) {
    return repairDisciplines(normalizeClubData(await readLocalJsonFile<ClubData>(defaultClubDataPath)));
  }
  let raw: ClubData;
  try {
    raw = await readJsonFromS3<ClubData>(clubDataKey());
  } catch (error) {
    if (!isS3NotFoundError(error)) throw error;
    const seedData = normalizeClubData(await readLocalJsonFile<ClubData>(defaultClubDataPath));
    await writeClubData(seedData);
    return seedData;
  }
  return repairDisciplines(normalizeClubData(raw));
}

export async function writeClubData(data: ClubData): Promise<void> {
  const normalized = normalizeClubData({ ...data, updatedAt: new Date().toISOString() });
  await writeJsonToS3(clubDataKey(), normalized);
}

let clubDataQueue: Promise<unknown> = Promise.resolve();

/**
 * Lecture, modification et écriture sérialisées : les requêtes simultanées d'un même serveur
 * s'exécutent l'une après l'autre sur des données fraîchement relues, au lieu de s'écraser.
 * À utiliser pour toute modification des données du club ; faire d'abord les opérations lentes
 * (Clerk, PDF, envoi de fichiers) puis appeler cette fonction pour la seule mise à jour.
 * `mutator` modifie l'objet reçu sur place ; lever une erreur annule l'écriture.
 */
export function updateClubData<T>(mutator: (data: ClubData) => Promise<T> | T): Promise<T> {
  const run = clubDataQueue.then(async () => {
    const data = await readClubData();
    const result = await mutator(data);
    await writeClubData(data);
    return result;
  });
  clubDataQueue = run.catch(() => undefined);
  return run;
}
