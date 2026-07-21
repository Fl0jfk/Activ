import { NextRequest, NextResponse } from "next/server";
import { canManageSiteData, getCurrentUserContext } from "@/lib/clerk";
import { uploadSiteImageFile, validateSiteImageFile } from "@/lib/s3-upload";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user || !canManageSiteData(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const validated = validateSiteImageFile(formData.get("file") as File | null);
    if (!validated.ok) {
      return NextResponse.json({ message: validated.message }, { status: 400 });
    }

    const uploaded = await uploadSiteImageFile(validated.file);
    return NextResponse.json(uploaded);
  } catch (error) {
    console.error("Failed to upload site image", error);
    if (error instanceof Error && error.message.includes("BUCKET_NAME")) {
      return NextResponse.json({ message: "Bucket non configuré." }, { status: 500 });
    }
    return NextResponse.json({ message: "Impossible d'envoyer l'image." }, { status: 500 });
  }
}
