import { NextResponse } from "next/server";
import { readSiteData } from "@/lib/site-data";

export async function GET() {
  try {
    const data = await readSiteData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to read site data", error);
    return NextResponse.json(
      { message: "Impossible de charger les donnees du site." },
      { status: 500 }
    );
  }
}
