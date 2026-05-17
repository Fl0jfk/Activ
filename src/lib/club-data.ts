import { getApplicationDossierPhase } from "@/lib/dossier-workflow";
import type { AppRole } from "@/lib/roles";
import { readJsonFromS3, readLocalJsonFile, writeJsonToS3 } from "@/lib/s3-client";

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type ApplicationStatus = "pending" | "awaiting_document" | "approved" | "rejected";
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

export type TrialSlot = {
  id: string;
  disciplineId: string;
  title: string;
  startsAt: string;
  capacity: number;
  active: boolean;
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
};

export type DocumentRequestToken = {
  token: string;
  applicationId: string;
  email: string;
  requestedDocumentLabel: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type ClubData = {
  members: ClubMember[];
  trialSlots: TrialSlot[];
  applications: RegistrationApplication[];
  documentRequestTokens: DocumentRequestToken[];
  coachAbsenceRequests: CoachAbsenceRequest[];
  updatedAt: string;
};

const defaultClubDataPath = `${process.cwd()}/data/club-data.json`;
const defaultClubDataKey = "data/club-data.json";

function normalizeClubData(data: ClubData): ClubData {
  return {
    members: data.members ?? [],
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
      trialSlotId: application.trialSlotId ?? null,
      paymentMethod: application.paymentMethod ?? "",
      licenseEndDate: application.licenseEndDate ?? null,
      dossierPhase: getApplicationDossierPhase(application),
    })),
    documentRequestTokens: data.documentRequestTokens ?? [],
    coachAbsenceRequests: data.coachAbsenceRequests ?? [],
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

function clubDataKey(): string {
  return process.env.CLUB_DATA_KEY || defaultClubDataKey;
}

export async function readClubData(): Promise<ClubData> {
  try {
    const raw = await readJsonFromS3<ClubData>(clubDataKey());
    return normalizeClubData(raw);
  } catch {
    const seedData = normalizeClubData(await readLocalJsonFile<ClubData>(defaultClubDataPath));
    await writeClubData(seedData);
    return seedData;
  }
}

export async function writeClubData(data: ClubData): Promise<void> {
  const normalized = normalizeClubData({ ...data, updatedAt: new Date().toISOString() });
  await writeJsonToS3(clubDataKey(), normalized);
}
