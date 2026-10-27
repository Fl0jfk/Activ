import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import type { PaymentMethod, PaymentStatus } from "@/lib/club-data";
import { readClubData, writeClubData } from "@/lib/club-data";
import { addOneYearLicenseDate } from "@/lib/license-renewal";
import { notifyMemberPaymentReceipt } from "@/lib/payment-receipt-notify";
import { buildRegistrationApplication } from "@/lib/registration-application";
import { readSiteData } from "@/lib/site-data";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "check", "bank_transfer", "card", "other", ""];

export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    disciplineIds?: string[];
    signedBulletinReceived?: boolean;
    signedBulletinReceivedAt?: string;
    amountPaid?: number | string | null;
    paymentStatus?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    notes?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const firstName = payload.firstName?.trim() ?? "";
  const lastName = payload.lastName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!firstName || !lastName) {
    return jsonError("Le prénom et le nom sont obligatoires.", 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Adresse e-mail invalide.", 400);
  }

  const siteData = await readSiteData();
  const requestedDisciplineIds = Array.isArray(payload.disciplineIds)
    ? [...new Set(payload.disciplineIds.filter(Boolean))]
    : [];
  if (requestedDisciplineIds.length === 0) {
    return jsonError("Sélectionnez au moins une activité.", 400);
  }
  const unknownDiscipline = requestedDisciplineIds.find(
    (id) => !siteData.disciplines.some((discipline) => discipline.id === id),
  );
  if (unknownDiscipline) {
    return jsonError("Activité introuvable.", 404);
  }

  const signed = payload.signedBulletinReceived === true;
  const signedDate =
    signed && payload.signedBulletinReceivedAt?.trim()
      ? payload.signedBulletinReceivedAt.trim()
      : signed
        ? todayIsoDate()
        : null;

  const requestedPaymentStatus: PaymentStatus =
    payload.paymentStatus === "paid"
      ? "paid"
      : payload.paymentStatus === "partial"
        ? "partial"
        : "unpaid";
  const paymentStatus: PaymentStatus =
    signed || requestedPaymentStatus !== "unpaid" ? requestedPaymentStatus : "unpaid";
  const paymentMethod: PaymentMethod = PAYMENT_METHODS.includes(payload.paymentMethod ?? "")
    ? (payload.paymentMethod ?? "")
    : "";
  if (paymentStatus === "paid" && !paymentMethod) {
    return jsonError("Choisissez le mode de paiement encaissé.", 400);
  }

  const amountPaid = parseAmount(payload.amountPaid);
  const finalised = paymentStatus === "paid";
  const application = buildRegistrationApplication({
    disciplineId: requestedDisciplineIds[0]!,
    disciplineIds: requestedDisciplineIds,
    origin: "paper",
    signedBulletinReceivedAt: signedDate,
    amountPaid,
    firstName,
    lastName,
    phone: payload.phone?.trim() ?? "",
    address: payload.address?.trim() ?? "",
    postalCode: payload.postalCode?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    email,
    motivation: "",
    clerkUserId: null,
  });

  application.status = signed || finalised ? "approved" : "pending";
  application.dossierPhase = finalised ? "finalized" : signed ? "payment" : "reception";
  application.paymentStatus = paymentStatus;
  application.paymentMethod = finalised ? paymentMethod : "";
  application.notes = payload.notes?.trim() ?? "";
  application.licenseEndDate = finalised ? addOneYearLicenseDate() : null;

  const data = await readClubData();
  data.applications.unshift(application);
  await writeClubData(data);

  let receiptSent = false;
  if (finalised && application.email) {
    const receipt = await notifyMemberPaymentReceipt(application);
    receiptSent = receipt.sent;
  }

  return jsonOk(
    {
      message: finalised
        ? receiptSent
          ? "Adhérent papier ajouté, paiement enregistré et attestation envoyée par e-mail."
          : "Adhérent papier ajouté et paiement enregistré. L'attestation est téléchargeable depuis le dossier."
        : "Adhérent papier ajouté.",
      application,
      receiptSent,
    },
    201,
  );
}
