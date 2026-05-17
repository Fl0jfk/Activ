import { NextRequest, NextResponse } from "next/server";
import { readClubData, writeClubData } from "@/lib/club-data";
import { canAccessClubOperations, getCurrentUserContext } from "@/lib/clerk";

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET() {
  const data = await readClubData();
  return NextResponse.json(
    data.trialSlots
      .filter((slot) => slot.active)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  );
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser || !canAccessClubOperations(currentUser)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      disciplineId?: string;
      title?: string;
      startsAt?: string;
      capacity?: number;
    };

    if (!payload.disciplineId || !payload.title || !payload.startsAt) {
      return NextResponse.json({ message: "Champs requis manquants." }, { status: 400 });
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
    return NextResponse.json({ message: "Creneau cree." }, { status: 201 });
  } catch (error) {
    console.error("Failed to create trial slot", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
