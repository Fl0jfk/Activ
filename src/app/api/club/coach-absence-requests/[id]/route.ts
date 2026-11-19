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
  let payload: { action?: "approved" | "rejected" };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  if (payload.action !== "approved" && payload.action !== "rejected") {
    return NextResponse.json({ message: "Action invalide." }, { status: 400 });
  }

  try {
    if (payload.action === "rejected") {
      const result = await rejectCoachAbsenceRequest(id, user.userId);
      if (!result.ok) {
        return NextResponse.json({ message: result.message }, { status: 400 });
      }
      return NextResponse.json({ message: "Demande refusée." });
    }

    const result = await approveCoachAbsenceRequest(id, user.userId);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }

    let message = "Absence validée et séance annulée.";
    if (result.notifyError) {
      message += ` Mais l'e-mail aux adhérents n'a pas pu partir : ${result.notifyError}`;
    } else if (result.notified > 0) {
      message += ` ${result.notified} adhérent${result.notified > 1 ? "s" : ""} prévenu${result.notified > 1 ? "s" : ""} par e-mail.`;
    } else {
      message += " Aucun adhérent à prévenir pour cette activité.";
    }
    return NextResponse.json({
      message,
      notified: result.notified,
      ...(result.notifyError ? { notifyError: result.notifyError } : {}),
    });
  } catch (error) {
    console.error("Failed to review coach absence", error);
    return NextResponse.json({ message: "Erreur serveur : la demande n'a pas pu être traitée." }, { status: 500 });
  }
}
