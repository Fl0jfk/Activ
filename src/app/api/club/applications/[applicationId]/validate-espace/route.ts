import { NextResponse } from "next/server";
import { buildMemberClerkMetadata, canAccessClubOperations, getCurrentUserContext, updateUserMetadata } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";

export async function POST(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser || !canAccessClubOperations(currentUser)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const { applicationId } = await context.params;
  const data = await readClubData();
  const application = data.applications.find((entry) => entry.id === applicationId);
  if (!application) {
    return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
  }

  if (!application.clerkUserId) {
    return NextResponse.json(
      { message: "Aucun compte Clerk lie a ce dossier." },
      { status: 400 },
    );
  }

  application.dossierPhase = "documents";
  application.status = "pending";

  const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
  if (member) {
    member.membershipStatus = "pending";
    member.updatedAt = new Date().toISOString();
  }

  const disciplineIds = application.disciplineId ? [application.disciplineId] : [];
  const { privateMetadata, publicMetadata } = buildMemberClerkMetadata({
    disciplineIds,
    espaceValidated: true,
    membershipStatus: "pending",
    registrationState: "espace_active",
  });

  await updateUserMetadata(application.clerkUserId, privateMetadata, publicMetadata);
  await writeClubData(data);

  return NextResponse.json({
    message: "Espace membre active. Le candidat peut se connecter.",
  });
}
