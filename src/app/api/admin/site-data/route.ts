import { NextRequest, NextResponse } from "next/server";
import { readSiteData, writeSiteData } from "@/lib/site-data";

function hasValidPassword(request: NextRequest): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = request.headers.get("x-admin-password");

  if (!configuredPassword) {
    return false;
  }

  return providedPassword === configuredPassword;
}

export async function GET(request: NextRequest) {
  if (!hasValidPassword(request)) {
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
  if (!hasValidPassword(request)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    await writeSiteData(payload);
    return NextResponse.json({ message: "Donnees enregistrees." });
  } catch (error) {
    console.error("Failed to save admin site data", error);
    return NextResponse.json(
      { message: "Impossible d'enregistrer les donnees." },
      { status: 500 }
    );
  }
}
