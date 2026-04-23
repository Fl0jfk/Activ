import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readClubData, writeClubData } from "@/lib/club-data";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function createS3Client() {
  return new S3Client({
    region: process.env.REGION || "eu-west-1",
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const file = formData.get("file");
  if (!token || !(file instanceof File)) {
    return NextResponse.json({ message: "Requete invalide." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "Fichier trop volumineux (max 5 Mo)." }, { status: 400 });
  }

  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    return NextResponse.json({ message: "Bucket non configure." }, { status: 500 });
  }

  const data = await readClubData();
  const tokenEntry = data.documentRequestTokens.find((entry) => entry.token === token);
  if (!tokenEntry || tokenEntry.usedAt) {
    return NextResponse.json({ message: "Lien invalide ou deja utilise." }, { status: 400 });
  }
  if (new Date(tokenEntry.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ message: "Lien expire." }, { status: 400 });
  }

  const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
  if (!application) {
    return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
  }

  const bytes = await file.arrayBuffer();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `data/club-documents/public/${application.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const s3 = createS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || "application/octet-stream",
    }),
  );

  application.documents.push({
    name: file.name,
    url: `s3://${bucketName}/${key}`,
    uploadedAt: new Date().toISOString(),
  });
  application.status = "pending";
  tokenEntry.usedAt = new Date().toISOString();
  await writeClubData(data);

  return NextResponse.json({ message: "Document recu, merci." });
}
