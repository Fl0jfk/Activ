import { NextRequest, NextResponse } from "next/server";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import { canAccessAdminSpace, getCurrentUserContext } from "@/lib/clerk";

async function canManageSiteData() {
  const user = await getCurrentUserContext();
  if (!user) {
    return false;
  }
  return canAccessAdminSpace(user.publicFunctions);
}

export async function GET() {
  if (!(await canManageSiteData())) {
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
  if (!(await canManageSiteData())) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }
  try {
    const payload = await request.json();
    await writeSiteData(payload);
    return NextResponse.json({ message: "Donnees enregistrees." });
  } catch (error) {
    console.error("Failed to save admin site data", error);
    return NextResponse.json({ message: "Impossible d'enregistrer les donnees." },{ status: 500 });
  }
}
