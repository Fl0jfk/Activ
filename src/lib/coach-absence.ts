import type { CoachAbsenceRequest } from "@/lib/club-data";
import { readClubData, writeClubData } from "@/lib/club-data";
import { notifyDisciplineSessionCancelled } from "@/lib/session-cancel-notify";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import type { ScheduleException } from "@/lib/site-data-types";

import { randomId } from "@/lib/ids";

export async function approveCoachAbsenceRequest(
  requestId: string,
  reviewedByUserId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [clubData, siteData] = await Promise.all([readClubData(), readSiteData()]);
  const request = clubData.coachAbsenceRequests.find((r) => r.id === requestId);

  if (!request) {
    return { ok: false, message: "Demande introuvable." };
  }
  if (request.status !== "pending") {
    return { ok: false, message: "Cette demande a déjà été traitée." };
  }

  const reason = `Absence coach : ${request.reason}`;

  const exceptions = siteData.scheduleExceptions ?? [];
  const existingIndex = exceptions.findIndex(
    (ex) => ex.scheduleSlotId === request.scheduleSlotId && ex.date === request.sessionDate
  );

  const exception: ScheduleException = {
    id: existingIndex >= 0 ? exceptions[existingIndex].id : randomId("exc"),
    scheduleSlotId: request.scheduleSlotId,
    date: request.sessionDate,
    status: "cancelled",
    reason,
  };

  if (existingIndex >= 0) {
    exceptions[existingIndex] = exception;
  } else {
    exceptions.push(exception);
  }

  await writeSiteData({ ...siteData, scheduleExceptions: exceptions });

  request.status = "approved";
  request.reviewedAt = new Date().toISOString();
  request.reviewedByUserId = reviewedByUserId;
  await writeClubData(clubData);

  await notifyDisciplineSessionCancelled({
    disciplineId: request.disciplineId,
    sessionDate: request.sessionDate,
    reason: request.reason,
  });

  return { ok: true };
}

export async function rejectCoachAbsenceRequest(
  requestId: string,
  reviewedByUserId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const clubData = await readClubData();
  const request = clubData.coachAbsenceRequests.find((r) => r.id === requestId);

  if (!request) {
    return { ok: false, message: "Demande introuvable." };
  }
  if (request.status !== "pending") {
    return { ok: false, message: "Cette demande a déjà été traitée." };
  }

  request.status = "rejected";
  request.reviewedAt = new Date().toISOString();
  request.reviewedByUserId = reviewedByUserId;
  await writeClubData(clubData);

  return { ok: true };
}

export function listPendingCoachAbsences(requests: CoachAbsenceRequest[]): CoachAbsenceRequest[] {
  return requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}
