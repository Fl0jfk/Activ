import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { loadClubData, requireApplication, saveClubData } from "@/lib/club-repository";
import { syncClerkAfterEspaceValidation } from "@/lib/registration-clerk-sync";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const { applicationId } = await context.params;
  const data = await loadClubData();
  const applicationResult = requireApplication(data, applicationId);
  if (applicationResult instanceof NextResponse) {
    return applicationResult;
  }
  const application = applicationResult;

  if (!application.clerkUserId) {
    return jsonError("Aucun compte Clerk lie a ce dossier.", 400);
  }

  application.dossierPhase = "documents";
  application.status = "pending";

  const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
  if (member) {
    member.membershipStatus = "pending";
    member.updatedAt = new Date().toISOString();
  }

  await syncClerkAfterEspaceValidation(application);
  await saveClubData(data);

  return jsonOk({
    message: "Espace membre active. Le candidat peut se connecter.",
  });
}
