import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { readClubData, writeClubData } from "@/lib/club-data";
import type { MemberContactChangeRequest } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import {
  contactValuesEqual,
  contactValuesFromApplication,
  mergeContactInput,
  validateContactValues,
  type MemberContactInput,
} from "@/lib/member-contact";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;

  let payload: MemberContactInput & { applicationId?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const data = await readClubData();
  const myApplications = data.applications
    .filter((application) => application.clerkUserId === user.userId)
    .filter(
      (application) =>
        application.status !== "rejected" && application.status !== "cancelled",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const application =
    (payload.applicationId
      ? myApplications.find((entry) => entry.id === payload.applicationId)
      : undefined) ?? myApplications[0];

  if (!application) {
    return jsonError(
      "Aucun dossier actif n'est rattaché à votre compte. Contactez le bureau.",
      404,
    );
  }

  const values = mergeContactInput(application, payload);
  const validation = validateContactValues(values, { requireEmail: true });
  if (!validation.ok) {
    return jsonError(validation.message, 400);
  }

  if (contactValuesEqual(values, contactValuesFromApplication(application))) {
    return jsonError("Aucune modification à demander.", 400);
  }

  const existingPending = (data.contactChangeRequests ?? []).find(
    (entry) =>
      entry.applicationId === application.id && entry.status === "pending",
  );

  const now = new Date().toISOString();
  const nextRequest: MemberContactChangeRequest = {
    id: existingPending?.id ?? randomId("contact-change"),
    applicationId: application.id,
    clerkUserId: application.clerkUserId,
    status: "pending",
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    address: values.address,
    postalCode: values.postalCode,
    city: values.city,
    createdAt: existingPending?.createdAt ?? now,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: "",
  };

  data.contactChangeRequests = [
    nextRequest,
    ...(data.contactChangeRequests ?? []).filter(
      (entry) => entry.id !== nextRequest.id,
    ),
  ];
  await writeClubData(data);

  return jsonOk(
    {
      message:
        "Votre demande de modification est envoyée. Le bureau doit la valider avant qu'elle soit appliquée.",
      request: nextRequest,
    },
    201,
  );
}
