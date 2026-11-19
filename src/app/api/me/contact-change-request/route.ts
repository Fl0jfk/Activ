import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { rejectionResponse } from "@/lib/application-route-utils";
import { updateClubData } from "@/lib/club-data";
import type { MemberContactChangeRequest } from "@/lib/club-data";
import { TransitionRejection } from "@/lib/dossier-transitions";
import { randomId } from "@/lib/ids";
import {
  contactValuesEqual,
  contactValuesFromApplication,
  mergeContactInput,
  validateContactValues,
  type MemberContactInput,
} from "@/lib/member-contact";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;

  const limit = checkRateLimit(`contact-change:${user.userId}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError("Trop de demandes envoyées. Réessayez plus tard.", 429);
  }

  let payload: MemberContactInput & { applicationId?: string };
  try {
    const raw = (await request.json()) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return jsonError("Corps de requête invalide.", 400);
    }
    payload = raw as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  try {
    const nextRequest = await updateClubData<MemberContactChangeRequest>((data) => {
      const myApplications = data.applications
        .filter((application) => application.clerkUserId === user.userId)
        .filter(
          (application) =>
            application.status !== "rejected" && application.status !== "cancelled",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const application =
        (typeof payload.applicationId === "string"
          ? myApplications.find((entry) => entry.id === payload.applicationId)
          : undefined) ?? myApplications[0];

      if (!application) {
        throw new TransitionRejection(
          "Aucun dossier actif n'est rattaché à votre compte. Contactez le bureau.",
          404,
        );
      }

      const values = mergeContactInput(application, payload);
      const validation = validateContactValues(values, { requireEmail: true });
      if (!validation.ok) {
        throw new TransitionRejection(validation.message, 400);
      }

      if (contactValuesEqual(values, contactValuesFromApplication(application))) {
        throw new TransitionRejection("Aucune modification à demander.", 400);
      }

      const existingPending = (data.contactChangeRequests ?? []).find(
        (entry) => entry.applicationId === application.id && entry.status === "pending",
      );

      const now = new Date().toISOString();
      const created: MemberContactChangeRequest = {
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
        created,
        ...(data.contactChangeRequests ?? []).filter((entry) => entry.id !== created.id),
      ];
      return created;
    });

    return jsonOk(
      {
        message:
          "Votre demande de modification est envoyée. Le bureau doit la valider avant qu'elle soit appliquée.",
        request: nextRequest,
      },
      201,
    );
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to create contact change request", error);
    return jsonError("Erreur serveur.", 500);
  }
}
