import { NextResponse } from "next/server";
import { readSiteImageObject } from "@/lib/s3-upload";

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { key: keyParts } = await context.params;
  const objectKey = keyParts.map((part) => decodeURIComponent(part)).join("/");

  try {
    const image = await readSiteImageObject(objectKey);
    if (!image) {
      return NextResponse.json({ message: "Image introuvable." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(image.body), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to read site image", error);
    return NextResponse.json({ message: "Image introuvable." }, { status: 404 });
  }
}
