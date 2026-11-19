import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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

export type DocumentKind = {
  contentType: string;
  ext: string;
  /** Peut être affiché dans le navigateur (PDF, images) ; sinon téléchargement forcé. */
  inline: boolean;
};

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);
const HEIF_BRANDS = new Set(["mif1", "msf1", "heif"]);

function asciiAt(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let index = start; index < start + length && index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]!);
  }
  return text;
}

/** Type réel d'un document d'après ses premiers octets (jamais d'après le type annoncé par le navigateur). */
export function detectDocumentKind(bytes: Uint8Array): DocumentKind | null {
  if (bytes.length < 12) return null;
  if (asciiAt(bytes, 0, 5) === "%PDF-") {
    return { contentType: "application/pdf", ext: "pdf", inline: true };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg", inline: true };
  }
  if (
    bytes[0] === 0x89 &&
    asciiAt(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", ext: "png", inline: true };
  }
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") {
    return { contentType: "image/webp", ext: "webp", inline: true };
  }
  if (asciiAt(bytes, 4, 4) === "ftyp") {
    const brand = asciiAt(bytes, 8, 4).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return { contentType: "image/heic", ext: "heic", inline: false };
    if (HEIF_BRANDS.has(brand)) return { contentType: "image/heif", ext: "heif", inline: false };
  }
  return null;
}

export const DOCUMENT_FORMAT_MESSAGE =
  "Format de fichier non accepté. Envoyez un PDF ou une photo (JPEG, PNG, WebP ou HEIC).";

export class InvalidDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentError";
  }
}

export function isInvalidDocumentError(error: unknown): error is InvalidDocumentError {
  return error instanceof InvalidDocumentError;
}

/** Contrôle rapide (présence, taille). Le type réel est vérifié à l'envoi par `inspectDocumentFile` / `uploadDocumentFile`. */
export function validateDocumentFile(file: File | null): { ok: true; file: File } | { ok: false; message: string } {
  if (!(file instanceof File)) {
    return { ok: false, message: "Fichier manquant." };
  }
  if (file.size === 0) {
    return { ok: false, message: "Le fichier est vide." };
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return { ok: false, message: "Fichier trop volumineux (max 5 Mo)." };
  }
  return { ok: true, file };
}

export type InspectedDocument = {
  bytes: Uint8Array;
  kind: DocumentKind;
  /** Nom d'affichage assaini, avec l'extension correspondant au vrai format. */
  displayName: string;
};

/** Nom de fichier sans chemin ni caractères douteux, dont l'extension correspond au format détecté. */
export function safeDisplayName(rawName: string | undefined, ext: string): string {
  const base = (rawName ?? "").split(/[\\/]/).pop() ?? "";
  const withoutExt = base.replace(/\.[A-Za-z0-9]{1,6}$/, "");
  const cleaned = withoutExt
    .replace(/[^\p{L}\p{N} ._()'’+-]+/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[. _-]+/, "")
    .trim()
    .slice(0, 100);
  return `${cleaned || "document"}.${ext}`;
}

/** Lit le fichier et contrôle son vrai format (liste blanche) ; le Content-Type du client est ignoré. */
export async function inspectDocumentFile(
  file: File | null,
): Promise<({ ok: true } & InspectedDocument) | { ok: false; message: string }> {
  const validated = validateDocumentFile(file);
  if (!validated.ok) return validated;
  const bytes = new Uint8Array(await validated.file.arrayBuffer());
  if (bytes.length > MAX_DOCUMENT_FILE_SIZE) {
    return { ok: false, message: "Fichier trop volumineux (max 5 Mo)." };
  }
  const kind = detectDocumentKind(bytes);
  if (!kind) return { ok: false, message: DOCUMENT_FORMAT_MESSAGE };
  return {
    ok: true,
    bytes,
    kind,
    displayName: safeDisplayName(validated.file.name, kind.ext),
  };
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "public";
}

function extensionForImageType(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "bin";
}

async function sniffImageContentType(file: File): Promise<string | null> {
  const declared = file.type.toLowerCase();
  if (declared === "image/jpg") return "image/jpeg";
  if (ALLOWED_IMAGE_TYPES.has(declared)) return declared;

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "image/jpeg";
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return "image/png";
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) return "image/gif";
  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    new TextDecoder().decode(header.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return null;
}

export async function validateSiteImageFile(
  file: File | null,
): Promise<{ ok: true; file: File } | { ok: false; message: string }> {
  if (!(file instanceof File)) {
    return { ok: false, message: "Fichier manquant." };
  }
  if (file.size > MAX_SITE_IMAGE_FILE_SIZE) {
    return { ok: false, message: "Image trop volumineuse (max 5 Mo)." };
  }
  const contentType = await sniffImageContentType(file);
  if (!contentType) {
    return {
      ok: false,
      message:
        "Format non supporté (JPEG, PNG, WebP ou GIF). Sur iPhone, choisissez « Image la plus compatible ».",
    };
  }
  if (file.type === contentType) {
    return { ok: true, file };
  }
  const fileName = file.name?.trim() || `photo.${extensionForImageType(contentType)}`;
  return { ok: true, file: new File([file], fileName, { type: contentType }) };
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
  const inspected = await inspectDocumentFile(file);
  if (!inspected.ok) {
    throw new InvalidDocumentError(inspected.message);
  }
  const segment = safePathSegment(options.userSegment ?? "public");
  const key = `${options.keyPrefix}/${segment}/${Date.now()}-${randomId("doc").slice(4)}.${inspected.kind.ext}`;
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(inspected.bytes),
      ContentType: inspected.kind.contentType,
      ContentDisposition: "attachment",
    }),
  );

  return {
    name: inspected.displayName,
    url: `s3://${bucketName}/${key}`,
    uploadedAt: new Date().toISOString(),
  };
}

/** Supprime un document déjà envoyé (annulation d'une opération échouée). N'échoue jamais. */
export async function deleteStoredDocument(url: string): Promise<void> {
  try {
    const parsed = parseS3Url(url);
    if (!parsed || !isAllowedClubDocumentKey(parsed.key)) return;
    const s3 = createS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: parsed.bucketName, Key: parsed.key }));
  } catch (error) {
    console.error("deleteStoredDocument failed", error);
  }
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
  const segment = safePathSegment(params.userSegment ?? "public");
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
  const key = `${params.keyPrefix}/${segment}/${Date.now()}-${randomId("doc").slice(4)}-${safeName}`;
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
      ContentDisposition: "attachment",
    }),
  );

  return {
    name: params.fileName,
    url: `s3://${bucketName}/${key}`,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Lit un document du club. Le type renvoyé est celui détecté dans le contenu (jamais celui enregistré
 * à l'envoi) : un fichier de type inconnu ressort en `application/octet-stream`, `inline` à faux.
 */
export async function readClubDocumentObject(objectKey: string): Promise<{
  body: Buffer;
  contentType: string;
  inline: boolean;
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
  const kind = detectDocumentKind(bytes);
  return {
    body: Buffer.from(bytes),
    contentType: kind?.contentType ?? "application/octet-stream",
    inline: kind?.inline ?? false,
  };
}
