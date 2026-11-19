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
  /** Montant réellement encaissé (€), pris en compte à la finalisation du paiement. */
  amountPaid?: number | null;
  /** Message visible par l'adhérent (les `notes` restent internes au bureau). */
  memberMessage?: string;
  trialSlotId?: string;
  dossierPhase?: ApplicationDossierPhase;
  /** Activités du dossier choisies par le bureau (la première devient la principale). */
  disciplineIds?: string[];
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
