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

  const siteData = await readSiteData();
  const clubData = await readClubData();
  const sessions = buildCoachUpcomingSessions(siteData, user.fullName, 28);
  const myRequests = clubData.coachAbsenceRequests.filter((r) => r.clerkUserId === user.userId);

  return NextResponse.json({ sessions, requests: myRequests });
}
