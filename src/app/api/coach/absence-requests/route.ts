import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext, isCoach } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";
import { readSiteData } from "@/lib/site-data";
import { buildCoachUpcomingSessions } from "@/lib/schedule-week";

export const dynamic = "force-dynamic";

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user || !isCoach(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    scheduleSlotId?: string;
    sessionDate?: string;
    reason?: string;
  };

  const scheduleSlotId = payload.scheduleSlotId?.trim();
  const sessionDate = payload.sessionDate?.trim();
  const reason = payload.reason?.trim();

  if (!scheduleSlotId || !sessionDate || !reason) {
    return NextResponse.json({ message: "Champs requis manquants." }, { status: 400 });
  }

  const siteData = await readSiteData();
  const sessions = buildCoachUpcomingSessions(siteData, user.fullName, 28);
  const session = sessions.find(
    (s) => s.scheduleSlotId === scheduleSlotId && s.date === sessionDate
  );

  if (!session) {
    return NextResponse.json({ message: "Séance introuvable ou non autorisée." }, { status: 400 });
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
}
