import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { canAccessClubOperations } from "@/lib/clerk";
import { jsonError } from "@/lib/api-response";
import { readClubData } from "@/lib/club-data";
import { isAllowedClubDocumentKey, parseS3Url, readClubDocumentObject } from "@/lib/s3-upload";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  const { requestId } = await context.params;
  const which = request.nextUrl.searchParams.get("which") === "bureau" ? "bureau" : "member";

  try {
    const data = await readClubData();
    const memberRequest = data.memberRequests.find((entry) => entry.id === requestId);
    if (!memberRequest) {
      return jsonError("Demande introuvable.", 404);
    }

    const isOwner = memberRequest.clerkUserId === auth.value.userId;
    if (!isOwner && !canAccessClubOperations(auth.value)) {
      return jsonError("Non autorisé.", 401);
    }

    const document =
      which === "bureau" ? memberRequest.bureauAttachment : memberRequest.attachment;
    if (!document?.url) {
      return jsonError("Aucune pièce jointe.", 404);
    }

    const parsed = parseS3Url(document.url);
    if (!parsed || !isAllowedClubDocumentKey(parsed.key)) {
      return jsonError("Document introuvable.", 404);
    }

    const file = await readClubDocumentObject(parsed.key);
    if (!file) {
      return jsonError("Document introuvable.", 404);
    }

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${document.name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Failed to read member request attachment", error);
    return jsonError("Document introuvable.", 404);
  }
}
