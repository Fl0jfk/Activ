import type { ApplicationDossierPhase, ApplicationStatus, PaymentMethod } from "@/lib/club-data";
import type { AppRole } from "@/lib/roles";

export type ApplicationUpdatePayload = {
  status?: ApplicationStatus;
  trialAttended?: boolean;
  paymentStatus?: "unpaid" | "partial" | "paid";
  paymentMethod?: PaymentMethod;
  notes?: string;
  role?: AppRole;
  licenseEndDate?: string | null;
  trialSlotId?: string;
  dossierPhase?: ApplicationDossierPhase;
  /** Coordonnées modifiables depuis la fiche du dossier. */
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
};
