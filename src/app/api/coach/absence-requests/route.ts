import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext, isCoach } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import { readSiteData } from "@/lib/site-data";
import { buildCoachUpcomingSessions } from "@/lib/schedule-week";

export const dynamic = "force-dynamic";

const MAX_REASON_LENGTH = 500;

export async function POST(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user || !isCoach(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  let payload: {
    scheduleSlotId?: unknown;
    sessionDate?: unknown;
    reason?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const scheduleSlotId = typeof payload.scheduleSlotId === "string" ? payload.scheduleSlotId.trim() : "";
  const sessionDate = typeof payload.sessionDate === "string" ? payload.sessionDate.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!scheduleSlotId || !sessionDate) {
    return NextResponse.json({ message: "Séance introuvable." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ message: "Indiquez le motif de votre absence." }, { status: 400 });
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { message: `Le motif ne doit pas dépasser ${MAX_REASON_LENGTH} caractères.` },
      { status: 400 },
    );
  }

  try {
    const siteData = await readSiteData();
    const sessions = buildCoachUpcomingSessions(siteData, user.fullName, 28);
    const session = sessions.find(
      (s) => s.scheduleSlotId === scheduleSlotId && s.date === sessionDate
    );

    if (!session) {
      return NextResponse.json({ message: "Séance introuvable ou non autorisée." }, { status: 400 });
    }
    if (session.cancelled) {
      return NextResponse.json({ message: "Cette séance est déjà annulée." }, { status: 409 });
    }

    const clubData = await readClubData();
    const duplicate = clubData.coachAbsenceRequests.find(
      (r) =>
        r.clerkUserId === user.userId &&
        r.scheduleSlotId === scheduleSlotId &&
        r.sessionDate === sessionDate &&
        r.status === "pending"
    );

    if (duplicate) {
      return NextResponse.json({ message: "Une demande est déjà en attente pour cette séance." }, { status: 409 });
    }

    clubData.coachAbsenceRequests.push({
      id: randomId("abs"),
      clerkUserId: user.userId,
      coachName: user.fullName,
      disciplineId: session.disciplineId,
      scheduleSlotId,
      sessionDate,
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    await writeClubData(clubData);

    return NextResponse.json({ message: "Demande d'absence envoyée à la direction." });
  } catch (error) {
    console.error("Failed to create coach absence request", error);
    return NextResponse.json({ message: "Erreur serveur : la demande n'a pas pu être envoyée." }, { status: 500 });
  }
}
