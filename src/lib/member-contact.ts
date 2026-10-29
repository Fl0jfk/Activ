import type { ClubMember, RegistrationApplication } from "@/lib/club-data";

export type MemberContactValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
};

export type MemberContactInput = Partial<MemberContactValues>;

export function splitFullName(
  fullName: string,
  firstName: string,
  lastName: string,
): { firstName: string; lastName: string } {
  if (firstName.trim() || lastName.trim()) {
    return { firstName: firstName.trim(), lastName: lastName.trim() };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/** Coordonnées actuellement enregistrées dans un dossier. */
export function contactValuesFromApplication(
  application: RegistrationApplication,
): MemberContactValues {
  const name = splitFullName(
    application.fullName,
    application.firstName ?? "",
    application.lastName ?? "",
  );
  return {
    firstName: name.firstName,
    lastName: name.lastName,
    email: application.email ?? "",
    phone: application.phone ?? "",
    address: application.address ?? "",
    postalCode: application.postalCode ?? "",
    city: application.city ?? "",
  };
}

/** Fusionne une saisie partielle avec les coordonnées existantes du dossier. */
export function mergeContactInput(
  application: RegistrationApplication,
  input: MemberContactInput,
): MemberContactValues {
  const current = contactValuesFromApplication(application);
  const value = (key: keyof MemberContactValues): string =>
    typeof input[key] === "string" ? input[key]!.trim() : current[key];
  return {
    firstName: value("firstName"),
    lastName: value("lastName"),
    email: value("email").toLowerCase(),
    phone: value("phone"),
    address: value("address"),
    postalCode: value("postalCode"),
    city: value("city"),
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactValues(
  values: MemberContactValues,
  options: { requireEmail?: boolean } = {},
): { ok: true } | { ok: false; message: string } {
  if (!values.firstName.trim() || !values.lastName.trim()) {
    return { ok: false, message: "Le prénom et le nom sont obligatoires." };
  }
  if (!values.email) {
    return options.requireEmail
      ? { ok: false, message: "L'adresse e-mail est obligatoire." }
      : { ok: true };
  }
  if (!EMAIL_PATTERN.test(values.email)) {
    return { ok: false, message: "Adresse e-mail invalide." };
  }
  return { ok: true };
}

export function contactValuesEqual(
  a: MemberContactValues,
  b: MemberContactValues,
): boolean {
  return (Object.keys(a) as (keyof MemberContactValues)[]).every(
    (key) => a[key].trim().toLowerCase() === b[key].trim().toLowerCase(),
  );
}

/** Applique les coordonnées à un dossier et reconstruit le nom affiché. */
export function applyContactValues(
  application: RegistrationApplication,
  values: MemberContactValues,
): void {
  application.firstName = values.firstName.trim();
  application.lastName = values.lastName.trim();
  application.fullName =
    `${application.firstName} ${application.lastName}`.trim() ||
    application.fullName.trim() ||
    values.email;
  application.email = values.email.trim().toLowerCase();
  application.phone = values.phone.trim();
  application.address = values.address.trim();
  application.postalCode = values.postalCode.trim();
  application.city = values.city.trim();
}

/** Garde la fiche membre synchronisée avec le dossier. */
export function applyContactValuesToMember(
  member: ClubMember,
  application: RegistrationApplication,
): void {
  member.fullName = application.fullName;
  if (application.email.trim()) {
    member.email = application.email.trim().toLowerCase();
  }
  member.updatedAt = new Date().toISOString();
}
