import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  applyContactValues,
  applyContactValuesToMember,
  type MemberContactValues,
} from "@/lib/member-contact";
import { syncContactToClerk } from "@/lib/member-contact-clerk";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }
  const reviewer = auth.value;

  const { requestId } = await context.params;

  let payload: { action?: "approve" | "reject"; reason?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  if (payload.action !== "approve" && payload.action !== "reject") {
    return jsonError("Action invalide.", 400);
  }

  const data = await readClubData();
  const changeRequest = (data.contactChangeRequests ?? []).find(
    (entry) => entry.id === requestId,
  );
  if (!changeRequest) {
    return jsonError("Demande introuvable.", 404);
  }
  if (changeRequest.status !== "pending") {
    return jsonError("Cette demande a déjà été traitée.", 409);
  }

  const now = new Date().toISOString();

  if (payload.action === "reject") {
    changeRequest.status = "rejected";
    changeRequest.reviewedAt = now;
    changeRequest.reviewedBy = reviewer.fullName;
    changeRequest.rejectionReason = payload.reason?.trim() ?? "";
    await writeClubData(data);
    return jsonOk({ message: "Demande refusée." });
  }

  const application = data.applications.find(
    (entry) => entry.id === changeRequest.applicationId,
  );
  if (!application) {
    return jsonError("Le dossier lié à cette demande est introuvable.", 404);
  }

  const values: MemberContactValues = {
    firstName: changeRequest.firstName,
    lastName: changeRequest.lastName,
    email: changeRequest.email,
    phone: changeRequest.phone,
    address: changeRequest.address,
    postalCode: changeRequest.postalCode,
    city: changeRequest.city,
  };

  applyContactValues(application, values);

  const member = data.members.find(
    (entry) => entry.clerkUserId === application.clerkUserId,
  );
  if (member) {
    applyContactValuesToMember(member, application);
    member.updatedAt = now;
  }

  changeRequest.status = "approved";
  changeRequest.reviewedAt = now;
  changeRequest.reviewedBy = reviewer.fullName;
  changeRequest.rejectionReason = "";

  await writeClubData(data);

  const sync = await syncContactToClerk({
    clerkUserId: application.clerkUserId,
    values,
  });

  return jsonOk({
    message: sync.ok
      ? "Modification validée. Les coordonnées et l'adresse de connexion sont à jour."
      : `Modification validée. ${sync.warning}`,
    warning: sync.ok ? undefined : sync.warning,
  });
}
