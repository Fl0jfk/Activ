import { jsonError, jsonOk } from "@/lib/api-response";
import { readClubData, writeClubData } from "@/lib/club-data";
import { uploadDocumentFile, validateDocumentFile } from "@/lib/s3-upload";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const file = formData.get("file");

  if (!token) {
    return jsonError("Requete invalide.", 400);
  }

  const validated = validateDocumentFile(file instanceof File ? file : null);
  if (!validated.ok) {
    return jsonError(validated.message, 400);
  }

  const data = await readClubData();
  const tokenEntry = data.documentRequestTokens.find((entry) => entry.token === token);
  if (!tokenEntry || tokenEntry.usedAt) {
    return jsonError("Lien invalide ou deja utilise.", 400);
  }
  if (new Date(tokenEntry.expiresAt).getTime() < Date.now()) {
    return jsonError("Lien expire.", 400);
  }

  const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
  if (!application) {
    return jsonError("Demande introuvable.", 404);
  }

  try {
    const uploaded = await uploadDocumentFile(validated.file, {
      keyPrefix: "data/club-documents/public",
      userSegment: application.id,
    });

    application.documents.push({
      name: uploaded.name,
      url: uploaded.url,
      uploadedAt: uploaded.uploadedAt,
    });
    application.status = "pending";
    tokenEntry.usedAt = new Date().toISOString();
    await writeClubData(data);

    return jsonOk({ message: "Document recu, merci." });
  } catch (error) {
    console.error("Failed public document upload", error);
    if (error instanceof Error && error.message.includes("BUCKET_NAME")) {
      return jsonError("Bucket non configure.", 500);
    }
    return jsonError("Erreur serveur.", 500);
  }
}
