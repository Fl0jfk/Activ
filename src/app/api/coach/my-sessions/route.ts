import { NextResponse } from "next/server";
import { getCurrentUserContext, isCoach } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { buildCoachUpcomingSessions } from "@/lib/schedule-week";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user || !isCoach(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  try {
    const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
    const sessions = buildCoachUpcomingSessions(siteData, user.fullName, 28);
    const requests = clubData.coachAbsenceRequests
      .filter((r) => r.clerkUserId === user.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const disciplineNames = Object.fromEntries(
      siteData.disciplines.map((discipline) => [discipline.id, discipline.name]),
    );

    return NextResponse.json({ sessions, requests, disciplineNames });
  } catch (error) {
    console.error("Failed to load coach sessions", error);
    return NextResponse.json({ message: "Impossible de charger vos séances." }, { status: 500 });
  }
}
