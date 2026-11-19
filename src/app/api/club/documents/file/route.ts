import { NextRequest } from "next/server";
import { requireClubOps } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-response";
import { clubDocumentResponse } from "@/lib/document-response";
import { isAllowedClubDocumentKey, parseS3Url, readClubDocumentObject } from "@/lib/s3-upload";

export async function GET(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const urlParam = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const keyParam = request.nextUrl.searchParams.get("key")?.trim() ?? "";

  let objectKey = keyParam;
  if (!objectKey && urlParam) {
    const parsed = parseS3Url(urlParam);
    if (!parsed) {
      return jsonError("Adresse du document invalide.", 400);
    }
    objectKey = parsed.key;
  }

  if (!objectKey || !isAllowedClubDocumentKey(objectKey)) {
    return jsonError("Document introuvable.", 404);
  }

  try {
    const document = await readClubDocumentObject(objectKey);
    if (!document) {
      return jsonError("Document introuvable.", 404);
    }

    const fileName = objectKey.split("/").pop() || "document";
    return clubDocumentResponse(document, fileName, {
      forceDownload: request.nextUrl.searchParams.get("download") === "1",
    });
  } catch (error) {
    console.error("Failed to read club document", error);
    return jsonError("Document introuvable.", 404);
  }
}
