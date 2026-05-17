import type { ClubData, RegistrationApplication } from "@/lib/club-data";
import { readClubData, writeClubData } from "@/lib/club-data";
import { jsonError } from "@/lib/api-response";
import { NextResponse } from "next/server";

export async function loadClubData(): Promise<ClubData> {
  return readClubData();
}

export async function saveClubData(data: ClubData): Promise<void> {
  await writeClubData(data);
}

export function findApplication(
  data: ClubData,
  applicationId: string,
): RegistrationApplication | undefined {
  return data.applications.find((entry) => entry.id === applicationId);
}

export function requireApplication(
  data: ClubData,
  applicationId: string,
): RegistrationApplication | NextResponse {
  const application = findApplication(data, applicationId);
  if (!application) {
    return jsonError("Demande introuvable.", 404);
  }
  return application;
}

export async function withClubData<T>(
  mutator: (data: ClubData) => Promise<T> | T,
): Promise<T> {
  const data = await loadClubData();
  const result = await mutator(data);
  await saveClubData(data);
  return result;
}
