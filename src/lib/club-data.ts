import { readFile } from "node:fs/promises";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type ApplicationStatus = "pending" | "awaiting_document" | "approved" | "rejected";
export type ApplicationDossierPhase =
  | "reception"
  | "espace_validation"
  | "documents"
  | "payment"
  | "finalized";
export type PaymentMethod = "cash" | "check" | "bank_transfer" | "card" | "other" | "";

export type ClubMemberRole = "member" | "staff" | "coach" | "direction";

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

function createS3Client() {
  return new S3Client({
    region: process.env.REGION || "eu-west-1",
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    },
  });
}

function requireBucketConfig() {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing BUCKET_NAME environment variable.");
  }

  return {
    bucketName,
    clubDataKey: process.env.CLUB_DATA_KEY || defaultClubDataKey,
  };
}

function inferDossierPhaseFromLegacy(application: RegistrationApplication): ApplicationDossierPhase {
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
      dossierPhase: inferDossierPhaseFromLegacy(application),
    })),
    documentRequestTokens: data.documentRequestTokens ?? [],
    coachAbsenceRequests: data.coachAbsenceRequests ?? [],
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export async function readClubData(): Promise<ClubData> {
  const { bucketName, clubDataKey } = requireBucketConfig();
  const s3 = createS3Client();

  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: clubDataKey }));
    if (!object.Body) {
      throw new Error("S3 object body is empty.");
    }
    const content = await object.Body.transformToString();
    return normalizeClubData(JSON.parse(content) as ClubData);
  } catch {
    const content = await readFile(defaultClubDataPath, "utf-8");
    const seedData = normalizeClubData(JSON.parse(content) as ClubData);
    await writeClubData(seedData);
    return seedData;
  }
}

export async function writeClubData(data: ClubData): Promise<void> {
  const normalized = normalizeClubData({ ...data, updatedAt: new Date().toISOString() });
  const { bucketName, clubDataKey } = requireBucketConfig();
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: clubDataKey,
      Body: JSON.stringify(normalized, null, 2),
      ContentType: "application/json; charset=utf-8",
    }),
  );
}
