import { formatDateFr } from "@/components/forms/validators";
import type { BulletinValues } from "@/components/inscription/types";
import type { MembershipBulletinFormPayload } from "@/lib/membership-bulletin";

/** Corps commun à l'aperçu PDF et à l'envoi (sans mot de passe). Mêmes champs que le formulaire d'origine. */
export function buildBulletinPayload(
  values: BulletinValues,
  signatureDataUrl: string,
): MembershipBulletinFormPayload {
  const commitmentsAccepted =
    values.acceptRules && values.acceptHealth && values.acceptInsurance && values.acceptRefund;
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    address: values.address.trim(),
    postalCode: values.postalCode.trim(),
    city: values.city.trim(),
    email: values.email.trim().toLowerCase(),
    birthDate: values.birthDate,
    emergencyContactName: values.emergencyContactName.trim(),
    emergencyContactPhone: values.emergencyContactPhone.trim(),
    selectedSlots: values.selectedSlots,
    paymentPlan: values.paymentPlan,
    imageRights: values.imageRights === "refuse" ? "refuse" : "authorize",
    commitmentsAccepted,
    signedPlace: values.signedPlace.trim(),
    signedAt: formatDateFr(values.signedAt),
    signatureDataUrl,
  };
}
