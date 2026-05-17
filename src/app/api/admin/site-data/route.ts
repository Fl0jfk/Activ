import { NextRequest, NextResponse } from "next/server";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import type { AssociationData } from "@/lib/site-data-types";
import {
  canAccessClubOperations,
  canManageSiteData as userCanManageSiteData,
  getCurrentUserContext,
} from "@/lib/clerk";

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user || !canAccessClubOperations(user)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  try {
    const data = await readSiteData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to read admin site data", error);
    return NextResponse.json(
      { message: "Impossible de charger les donnees admin." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as Partial<AssociationData>;

    if (userCanManageSiteData(user)) {
      await writeSiteData(payload as AssociationData);
      return NextResponse.json({ message: "Donnees enregistrees." });
    }

    if (canAccessClubOperations(user) && payload.scheduleExceptions) {
      const current = await readSiteData();
      await writeSiteData({
        ...current,
        scheduleExceptions: payload.scheduleExceptions,
      });
      return NextResponse.json({ message: "Exceptions de planning enregistrees." });
    }

    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  } catch (error) {
    console.error("Failed to save admin site data", error);
    return NextResponse.json({ message: "Impossible d'enregistrer les donnees." }, { status: 500 });
  }
}
