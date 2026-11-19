import type { FieldErrors } from "@/components/forms/error-summary";
import type { MembershipImageRights, MembershipPaymentPlan } from "@/lib/membership-bulletin";

export type StepId = "identity" | "emergency" | "account" | "activities" | "commitments" | "signature" | "review";

export type BulletinValues = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  selectedSlots: string[];
  paymentPlan: MembershipPaymentPlan;
  /** Vide tant que l'adhérent n'a pas fait de choix explicite. */
  imageRights: MembershipImageRights | "";
  acceptRules: boolean;
  acceptHealth: boolean;
  acceptInsurance: boolean;
  acceptRefund: boolean;
  signedPlace: string;
  /** AAAA-MM-JJ ; renseigné à l'arrivée sur l'étape de signature. */
  signedAt: string;
};

export type StepContext = {
  revalidation: boolean;
  /** L'adresse saisie a été confirmée par code. */
  emailVerified: boolean;
  /** Un compte existe déjà pour l'adresse confirmée. */
  accountExists: boolean;
  password: string;
  passwordConfirm: string;
  hasSignature: boolean;
};

export type StepValidator = (values: BulletinValues, context: StepContext) => FieldErrors;
