import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, requireBucketConfig } from "@/lib/s3-client";
import { randomId } from "@/lib/ids";

export const MAX_DOCUMENT_FILE_SIZE = 5 * 1024 * 1024;

export type UploadedDocument = {
  name: string;
  url: string;
  uploadedAt: string;
};

export type UploadDocumentOptions = {
  keyPrefix: string;
  userSegment?: string;
};

export function validateDocumentFile(file: File | null): { ok: true; file: File } | { ok: false; message: string } {
  if (!(file instanceof File)) {
    return { ok: false, message: "Fichier manquant." };
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return { ok: false, message: "Fichier trop volumineux (max 5 Mo)." };
  }
  return { ok: true, file };
}

export async function uploadDocumentFile(
  file: File,
  options: UploadDocumentOptions,
): Promise<UploadedDocument> {
  const { bucketName } = requireBucketConfig();
  const bytes = await file.arrayBuffer();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const segment = options.userSegment ?? "public";
  const key = `${options.keyPrefix}/${segment}/${Date.now()}-${randomId("doc").slice(4)}.${ext}`;
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || "application/octet-stream",
    }),
  );

  return {
    name: file.name,
    url: `s3://${bucketName}/${key}`,
    uploadedAt: new Date().toISOString(),
  };
}
