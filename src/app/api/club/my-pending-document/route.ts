import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const clubData = await readClubData();
  const myApplications = clubData.applications.filter((a) => a.clerkUserId === user.userId);
  const awaitingApp = myApplications.find((a) => a.status === "awaiting_document");

  if (!awaitingApp) {
    return NextResponse.json({ pending: null });
  }

  const token = clubData.documentRequestTokens.find(
    (t) => t.applicationId === awaitingApp.id && !t.usedAt && new Date(t.expiresAt) > new Date()
  );

  if (!token) {
    return NextResponse.json({ pending: null });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return NextResponse.json({
    pending: {
      applicationId: awaitingApp.id,
      label: token.requestedDocumentLabel,
      uploadUrl: `${baseUrl}/piece-jointe?token=${token.token}`,
    },
  });
}
