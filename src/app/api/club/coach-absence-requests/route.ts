import { NextResponse } from "next/server";
import { canApproveCoachAbsences, getCurrentUserContext } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { listPendingCoachAbsences } from "@/lib/coach-absence";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user || !canApproveCoachAbsences(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const clubData = await readClubData();
  const pending = listPendingCoachAbsences(clubData.coachAbsenceRequests);
  const recent = clubData.coachAbsenceRequests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt))
    .slice(0, 10);

  return NextResponse.json({ pending, recent });
}
