import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, requireBucketConfig } from "@/lib/s3-client";
import { randomId } from "@/lib/ids";

export const MAX_DOCUMENT_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_SITE_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
export const SITE_IMAGES_PREFIX = "data/site-images";
export const CLUB_DOCUMENTS_PREFIX = "data/club-documents";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

export function validateSiteImageFile(file: File | null): { ok: true; file: File } | { ok: false; message: string } {
  if (!(file instanceof File)) {
    return { ok: false, message: "Fichier manquant." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, message: "Format non supporté (JPEG, PNG, WebP ou GIF)." };
  }
  if (file.size > MAX_SITE_IMAGE_FILE_SIZE) {
    return { ok: false, message: "Image trop volumineuse (max 5 Mo)." };
  }
  return { ok: true, file };
}

export function siteMediaPublicUrl(objectKey: string): string {
  return `/api/site-media/${objectKey
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export function isAllowedSiteImageKey(objectKey: string): boolean {
  return objectKey.startsWith(`${SITE_IMAGES_PREFIX}/`) && !objectKey.includes("..");
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

export async function uploadSiteImageFile(file: File): Promise<{ url: string; key: string }> {
  const { bucketName } = requireBucketConfig();
  const bytes = await file.arrayBuffer();
  const extFromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined;
  const extFromType =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "bin";
  const ext = extFromName && /^[a-z0-9]+$/i.test(extFromName) ? extFromName : extFromType;
  const key = `${SITE_IMAGES_PREFIX}/${Date.now()}-${randomId("img").slice(4)}.${ext}`;
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: siteMediaPublicUrl(key),
  };
}

export async function readSiteImageObject(objectKey: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  if (!isAllowedSiteImageKey(objectKey)) {
    return null;
  }

  const { bucketName } = requireBucketConfig();
  const s3 = createS3Client();
  const object = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  if (!object.Body) {
    return null;
  }

  const bytes = await object.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: object.ContentType || "application/octet-stream",
  };
}

export function parseS3Url(url: string): { bucketName: string; key: string } | null {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(url);
  if (!match) return null;
  return { bucketName: match[1], key: match[2] };
}

export function isAllowedClubDocumentKey(objectKey: string): boolean {
  return objectKey.startsWith(`${CLUB_DOCUMENTS_PREFIX}/`) && !objectKey.includes("..");
}

export async function uploadBytesToS3(params: {
  body: Buffer | Uint8Array;
  keyPrefix: string;
  fileName: string;
  contentType: string;
  userSegment?: string;
}): Promise<UploadedDocument> {
  const { bucketName } = requireBucketConfig();
  const segment = params.userSegment ?? "public";
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const key = `${params.keyPrefix}/${segment}/${Date.now()}-${randomId("doc").slice(4)}-${safeName}`;
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return {
    name: params.fileName,
    url: `s3://${bucketName}/${key}`,
    uploadedAt: new Date().toISOString(),
  };
}

export async function readClubDocumentObject(objectKey: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  if (!isAllowedClubDocumentKey(objectKey)) {
    return null;
  }

  const { bucketName } = requireBucketConfig();
  const s3 = createS3Client();
  const object = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  if (!object.Body) {
    return null;
  }

  const bytes = await object.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: object.ContentType || "application/octet-stream",
  };
}
