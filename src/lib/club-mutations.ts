import type { ApplicationDossierPhase, PaymentMethod } from "@/lib/club-data";

export type ApplicationUpdatePayload = {
  status?: "pending" | "awaiting_document" | "approved" | "rejected";
  trialAttended?: boolean;
  paymentStatus?: "unpaid" | "partial" | "paid";
  paymentMethod?: PaymentMethod;
  notes?: string;
  role?: "member" | "staff" | "coach" | "direction";
  licenseEndDate?: string | null;
  trialSlotId?: string;
  dossierPhase?: ApplicationDossierPhase;
};
