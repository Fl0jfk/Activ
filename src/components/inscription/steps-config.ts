import type { StepId } from "@/components/inscription/types";

export const ASSOCIATION_PAYEE = "Activ Sainte-Croix Sport et Culture";

export const STEP_INFO: Record<StepId, { label: string; title: string }> = {
  identity: { label: "Identité", title: "Vos informations" },
  emergency: { label: "Urgence", title: "Personne à prévenir en cas d’urgence" },
  account: { label: "Compte", title: "Votre compte" },
  activities: { label: "Activités", title: "Activités et paiement" },
  commitments: { label: "Engagements", title: "Vos engagements" },
  signature: { label: "Signature", title: "Votre signature" },
  review: { label: "Envoi", title: "Vérification et envoi" },
};

export const NEW_MEMBER_STEPS: readonly StepId[] = [
  "identity",
  "emergency",
  "account",
  "activities",
  "commitments",
  "signature",
  "review",
];

/** Revalidation par lien : le compte existe déjà, il n'y a pas d'étape « Votre compte ». */
export const REVALIDATION_STEPS: readonly StepId[] = NEW_MEMBER_STEPS.filter((step) => step !== "account");

/** Ordre d'affichage des champs (pour le focus sur la première erreur). */
export const FIELD_ORDER = [
  "firstName",
  "lastName",
  "birthDate",
  "phone",
  "address",
  "postalCode",
  "city",
  "emergencyContactName",
  "emergencyContactPhone",
  "email",
  "emailCode",
  "password",
  "passwordConfirm",
  "selectedSlots",
  "paymentPlan",
  "acceptRules",
  "acceptHealth",
  "acceptInsurance",
  "imageRights",
  "acceptRefund",
  "commitments",
  "signedPlace",
  "signedAt",
  "signature",
] as const;

export const FIELD_LABELS: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  birthDate: "Date de naissance",
  phone: "Téléphone",
  address: "Adresse",
  postalCode: "Code postal",
  city: "Commune",
  emergencyContactName: "Nom de la personne à prévenir",
  emergencyContactPhone: "Téléphone de la personne à prévenir",
  email: "Adresse e-mail",
  emailCode: "Code de confirmation",
  password: "Mot de passe",
  passwordConfirm: "Confirmation du mot de passe",
  selectedSlots: "Activités",
  paymentPlan: "Mode de paiement",
  acceptRules: "Règlement intérieur",
  acceptHealth: "Santé",
  acceptInsurance: "Assurance",
  imageRights: "Droit à l’image",
  acceptRefund: "Remboursement",
  commitments: "Engagements",
  signedPlace: "Lieu de signature",
  signedAt: "Date de signature",
  signature: "Signature",
};

/** Étape qui contient chaque champ (pour revenir au bon écran quand le serveur refuse une valeur). */
export function stepOfField(key: string, revalidation: boolean): StepId | null {
  switch (key) {
    case "firstName":
    case "lastName":
    case "birthDate":
    case "phone":
    case "address":
    case "postalCode":
    case "city":
      return "identity";
    case "emergencyContactName":
    case "emergencyContactPhone":
      return "emergency";
    case "email":
      return revalidation ? "identity" : "account";
    case "password":
      return "account";
    case "selectedSlots":
    case "paymentPlan":
      return "activities";
    case "commitments":
    case "imageRights":
      return "commitments";
    case "signature":
    case "signedAt":
    case "signedPlace":
      return "signature";
    default:
      return null;
  }
}
