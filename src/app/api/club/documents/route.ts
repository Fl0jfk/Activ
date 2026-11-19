import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { MINUTE, limitByKey, rejectOversizedUpload } from "@/lib/request-guard";
import {
  MAX_DOCUMENT_FILE_SIZE,
  isInvalidDocumentError,
  uploadDocumentFile,
  validateDocumentFile,
} from "@/lib/s3-upload";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  const limited = limitByKey("club-documents", auth.value.userId, { limit: 30, windowMs: 10 * MINUTE });
  if (limited) return limited;

  const oversized = rejectOversizedUpload(request, MAX_DOCUMENT_FILE_SIZE + 1024 * 1024);
  if (oversized) return oversized;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const validated = validateDocumentFile(file instanceof File ? file : null);
    if (!validated.ok) {
      return jsonError(validated.message, 400);
    }

    const uploaded = await uploadDocumentFile(validated.file, {
      keyPrefix: "data/club-documents",
      userSegment: auth.value.userId,
    });

    return jsonOk(uploaded);
  } catch (error) {
    if (isInvalidDocumentError(error)) {
      return jsonError(error.message, 400);
    }
    console.error("Failed to upload club document", error);
    if (error instanceof Error && error.message.includes("BUCKET_NAME")) {
      return jsonError("Le stockage des documents n'est pas disponible pour le moment.", 503);
    }
    return jsonError("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
}
