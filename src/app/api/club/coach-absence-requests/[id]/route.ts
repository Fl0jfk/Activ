import { NextRequest, NextResponse } from "next/server";
import { canApproveCoachAbsences, getCurrentUserContext } from "@/lib/clerk";
import { approveCoachAbsenceRequest, rejectCoachAbsenceRequest } from "@/lib/coach-absence";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserContext();
  if (!user || !canApproveCoachAbsences(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  const payload = (await request.json()) as { action?: "approved" | "rejected" };

  if (payload.action !== "approved" && payload.action !== "rejected") {
    return NextResponse.json({ message: "Action invalide." }, { status: 400 });
  }

  const result =
    payload.action === "approved"
      ? await approveCoachAbsenceRequest(id, user.userId)
      : await rejectCoachAbsenceRequest(id, user.userId);

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    message: payload.action === "approved" ? "Absence validée et séance annulée." : "Demande refusée.",
  });
}
