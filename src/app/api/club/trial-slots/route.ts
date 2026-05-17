import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { readClubData, writeClubData } from "@/lib/club-data";
import { randomId } from "@/lib/ids";

export async function GET() {
  const data = await readClubData();
  return jsonOk(
    data.trialSlots
      .filter((slot) => slot.active)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as {
      disciplineId?: string;
      title?: string;
      startsAt?: string;
      capacity?: number;
    };

    if (!payload.disciplineId || !payload.title || !payload.startsAt) {
      return jsonError("Champs requis manquants.", 400);
    }

    const data = await readClubData();
    data.trialSlots.push({
      id: randomId("trial"),
      disciplineId: payload.disciplineId,
      title: payload.title,
      startsAt: payload.startsAt,
      capacity: Math.max(1, payload.capacity ?? 12),
      active: true,
    });

    await writeClubData(data);
    return jsonOk({ message: "Creneau cree." }, 201);
  } catch (error) {
    console.error("Failed to create trial slot", error);
    return jsonError("Erreur serveur.", 500);
  }
}
