import { NextResponse } from "next/server";
import { canApproveCoachAbsences, getCurrentUserContext } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { listPendingCoachAbsences, listRecentCoachAbsences } from "@/lib/coach-absence";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user || !canApproveCoachAbsences(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  try {
    const clubData = await readClubData();
    const pending = listPendingCoachAbsences(clubData.coachAbsenceRequests);
    const recent = listRecentCoachAbsences(clubData.coachAbsenceRequests);

    return NextResponse.json({ pending, recent });
  } catch (error) {
    console.error("Failed to list coach absences", error);
    return NextResponse.json(
      { message: "Impossible de charger les demandes d'absence." },
      { status: 500 },
    );
  }
}
