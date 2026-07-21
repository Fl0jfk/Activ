import { NextRequest } from "next/server";
import { requireClubOps } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { notifyDisciplineSessionCancelled } from "@/lib/session-cancel-notify";
import { readSiteData } from "@/lib/site-data";

export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: {
    cancellations?: {
      scheduleSlotId?: string;
      date?: string;
      reason?: string;
      disciplineId?: string;
    }[];
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const cancellations = Array.isArray(payload.cancellations) ? payload.cancellations : [];
  if (cancellations.length === 0) {
    return jsonOk({ message: "Aucune notification à envoyer.", notified: 0 });
  }

  const siteData = await readSiteData();
  let notified = 0;
  let sent = 0;
  let failed = 0;

  for (const item of cancellations) {
    const scheduleSlotId = item.scheduleSlotId?.trim() ?? "";
    const date = item.date?.trim() ?? "";
    const reason = item.reason?.trim() ?? "";
    if (!scheduleSlotId || !date) continue;

    const slot = siteData.schedule.find((entry) => entry.id === scheduleSlotId);
    const disciplineId = item.disciplineId?.trim() || slot?.disciplineId;
    if (!disciplineId) continue;

    const result = await notifyDisciplineSessionCancelled({
      disciplineId,
      sessionDate: date,
      reason,
    });
    notified += 1;
    sent += result.sent;
    failed += result.failed;
  }

  return jsonOk({
    message:
      notified === 0
        ? "Aucune notification envoyée."
        : `Adhérents prévenus pour ${notified} annulation${notified > 1 ? "s" : ""} (${sent} e-mail${sent > 1 ? "s" : ""}).`,
    notified,
    sent,
    failed,
  });
}
