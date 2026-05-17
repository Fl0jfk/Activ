import { NextResponse } from "next/server";
import { canAccessClubOperations, deleteClerkUser, getCurrentUserContext } from "@/lib/clerk";
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

  application.status = "rejected";
  application.dossierPhase = "reception";

  const clerkUserId = application.clerkUserId;

  if (clerkUserId) {
    try {
      await deleteClerkUser(clerkUserId);
    } catch (error) {
      console.error("Failed to remove Clerk user on reject", error);
      return NextResponse.json(
        { message: "Impossible de supprimer le compte Clerk. Reessayez ou supprimez-le depuis le dashboard Clerk." },
        { status: 502 },
      );
    }
    application.clerkUserId = null;
    data.members = data.members.filter((entry) => entry.clerkUserId !== clerkUserId);
  }

  await writeClubData(data);

  return NextResponse.json({
    message: clerkUserId
      ? "Dossier refuse et compte Clerk supprime."
      : "Dossier refuse.",
  });
}
