import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { loadClubData, requireApplication, saveClubData } from "@/lib/club-repository";
import { uploadDocumentFile, validateDocumentFile } from "@/lib/s3-upload";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const { applicationId } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") ?? "").trim();
    const validated = validateDocumentFile(file instanceof File ? file : null);
    if (!validated.ok) {
      return jsonError(validated.message, 400);
    }

    const data = await loadClubData();
    const applicationResult = requireApplication(data, applicationId);
    if (applicationResult instanceof NextResponse) {
      return applicationResult;
    }
    const application = applicationResult;

    const uploaded = await uploadDocumentFile(validated.file, {
      keyPrefix: "data/club-documents/staff",
      userSegment: application.id,
    });

    const document = {
      name: label || uploaded.name,
      url: uploaded.url,
      uploadedAt: uploaded.uploadedAt,
    };
    application.documents.push(document);
    if (application.dossierPhase === "espace_validation") {
      application.dossierPhase = "documents";
    }
    if (application.status === "awaiting_document") {
      application.status = "pending";
    }
    await saveClubData(data);

    return jsonOk({ message: "Piece jointe ajoutee.", document });
  } catch (error) {
    console.error("Failed to upload application document", error);
    return jsonError("Erreur serveur.", 500);
  }
}
