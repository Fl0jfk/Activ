import { NextResponse } from "next/server";
import { canAccessClubOperations, getCurrentUserContext, tryDeleteClerkUser } from "@/lib/clerk";
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
  let clerkWarning: string | null = null;

  if (clerkUserId) {
    if (clerkUserId === currentUser.userId) {
      clerkWarning =
        "Le compte Clerk n'a pas été supprimé (c'est votre propre compte). Le dossier est tout de même refusé.";
    } else {
      const deletion = await tryDeleteClerkUser(clerkUserId);
      if (!deletion.ok) {
        // Ne bloque pas le refus : le dossier est refusé localement même si Clerk échoue.
        clerkWarning = `Dossier refusé, mais la suppression Clerk a échoué (${deletion.message}). Vous pouvez supprimer le compte manuellement dans le dashboard Clerk.`;
        console.error("Clerk delete failed on reject, continuing with local reject", {
          applicationId,
          clerkUserId,
          error: deletion.message,
        });
      }
    }
    application.clerkUserId = null;
    data.members = data.members.filter((entry) => entry.clerkUserId !== clerkUserId);
  }

  try {
    await writeClubData(data);
  } catch (error) {
    console.error("Failed to persist rejected application", error);
    return NextResponse.json({ message: "Erreur serveur lors de l'enregistrement." }, { status: 500 });
  }

  if (clerkWarning) {
    return NextResponse.json({ message: clerkWarning, clerkDeleted: false });
  }

  return NextResponse.json({
    message: clerkUserId
      ? "Dossier refuse et compte Clerk supprime."
      : "Dossier refuse.",
    clerkDeleted: Boolean(clerkUserId),
  });
}
