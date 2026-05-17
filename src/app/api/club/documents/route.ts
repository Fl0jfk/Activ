import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { uploadDocumentFile, validateDocumentFile } from "@/lib/s3-upload";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

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
    console.error("Failed to upload club document", error);
    if (error instanceof Error && error.message.includes("BUCKET_NAME")) {
      return jsonError("Bucket non configure.", 500);
    }
    return jsonError("Erreur serveur.", 500);
  }
}
