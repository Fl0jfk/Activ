import { readFile } from "node:fs/promises";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.REGION || "eu-west-1",
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    },
  });
}

export function requireBucketConfig(): { bucketName: string } {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing BUCKET_NAME environment variable.");
  }
  return { bucketName };
}

export async function readJsonFromS3<T>(key: string): Promise<T> {
  const { bucketName } = requireBucketConfig();
  const s3 = createS3Client();
  const object = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  if (!object.Body) {
    throw new Error("S3 object body is empty.");
  }
  const content = await object.Body.transformToString();
  return JSON.parse(content) as T;
}

export async function writeJsonToS3(key: string, data: unknown): Promise<void> {
  const { bucketName } = requireBucketConfig();
  const s3 = createS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json; charset=utf-8",
    }),
  );
}

export async function readLocalJsonFile<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as T;
}
