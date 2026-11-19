import type { FieldErrors } from "@/components/forms/error-summary";
import { validatePasswordPair } from "@/components/forms/account-fields";
import {
  MESSAGES,
  isValidEmail,
  isValidIsoDate,
  isValidPhone,
  isValidPostalCode,
  todayLocalIso,
} from "@/components/forms/validators";
import type { BulletinValues, StepContext, StepId } from "@/components/inscription/types";

function emailError(values: BulletinValues): string | undefined {
  if (!values.email.trim()) return MESSAGES.emailMissing;
  if (!isValidEmail(values.email)) return MESSAGES.email;
  return undefined;
}

function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)));
}

/** À appeler hors rendu (utilise la date du jour du navigateur). */
export function validateStep(step: StepId, values: BulletinValues, context: StepContext): FieldErrors {
  switch (step) {
    case "identity": {
      const errors: FieldErrors = {};
      if (!values.firstName.trim()) errors.firstName = MESSAGES.firstName;
      if (!values.lastName.trim()) errors.lastName = MESSAGES.lastName;
      if (!values.birthDate) {
        errors.birthDate = "Indiquez votre date de naissance.";
      } else if (!isValidIsoDate(values.birthDate) || values.birthDate < "1900-01-01") {
        errors.birthDate = "Cette date de naissance n’est pas valide.";
      } else if (values.birthDate >= todayLocalIso()) {
        errors.birthDate = "La date de naissance doit être dans le passé.";
      }
      if (!values.phone.trim()) errors.phone = MESSAGES.phoneMissing;
      else if (!isValidPhone(values.phone)) errors.phone = MESSAGES.phone;
      if (!values.address.trim()) errors.address = MESSAGES.address;
      if (!values.postalCode.trim()) errors.postalCode = MESSAGES.postalCode;
      else if (!isValidPostalCode(values.postalCode)) errors.postalCode = MESSAGES.postalCode;
      if (!values.city.trim()) errors.city = MESSAGES.city;
      if (context.revalidation) errors.email = emailError(values);
      return compact(errors);
    }
    case "emergency": {
      const errors: FieldErrors = {};
      if (!values.emergencyContactName.trim()) {
        errors.emergencyContactName = "Indiquez le nom de la personne à prévenir.";
      }
      if (!values.emergencyContactPhone.trim()) {
        errors.emergencyContactPhone = "Indiquez son numéro de téléphone.";
      } else if (!isValidPhone(values.emergencyContactPhone)) {
        errors.emergencyContactPhone = MESSAGES.phone;
      }
      return compact(errors);
    }
    case "account": {
      const errors: FieldErrors = {};
      errors.email = emailError(values);
      if (!errors.email) {
        if (!context.emailVerified) {
          errors.email = "Confirmez votre adresse avec le code reçu par e-mail avant de continuer.";
        } else if (context.accountExists) {
          errors.email = "Un compte existe déjà avec cette adresse : connectez-vous ou utilisez une autre adresse.";
        }
      }
      if (context.emailVerified && !context.accountExists) {
        const passwordErrors = validatePasswordPair(context.password, context.passwordConfirm);
        errors.password = passwordErrors.password;
        errors.passwordConfirm = passwordErrors.passwordConfirm;
      }
      return compact(errors);
    }
    case "activities": {
      const errors: FieldErrors = {};
      if (values.selectedSlots.length === 0) errors.selectedSlots = "Choisissez au moins une activité.";
      return errors;
    }
    case "commitments": {
      const errors: FieldErrors = {};
      const missing = "Cochez cette case pour continuer.";
      if (!values.acceptRules) errors.acceptRules = missing;
      if (!values.acceptHealth) errors.acceptHealth = missing;
      if (!values.acceptInsurance) errors.acceptInsurance = missing;
      if (!values.imageRights) errors.imageRights = "Choisissez une réponse pour le droit à l’image.";
      if (!values.acceptRefund) errors.acceptRefund = missing;
      return errors;
    }
    case "signature": {
      const errors: FieldErrors = {};
      if (!values.signedPlace.trim()) errors.signedPlace = "Indiquez le lieu de signature.";
      if (!values.signedAt) errors.signedAt = "Indiquez la date de signature.";
      else if (!isValidIsoDate(values.signedAt)) errors.signedAt = "Cette date n’est pas valide.";
      else if (values.signedAt > todayLocalIso()) errors.signedAt = "La date de signature ne peut pas être dans le futur.";
      if (!context.hasSignature) {
        errors.signature = "Signez dans le cadre blanc avec le doigt ou la souris, puis continuez.";
      }
      return errors;
    }
    case "review":
      return {};
  }
}
