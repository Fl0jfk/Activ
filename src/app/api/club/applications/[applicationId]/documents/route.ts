import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { canAccessClubOperations, getCurrentUserContext } from "@/lib/clerk";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser || !canAccessClubOperations(currentUser)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const { applicationId } = await context.params;
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    return NextResponse.json({ message: "Bucket non configure." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const label = String(formData.get("label") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Fichier manquant." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "Fichier trop volumineux (max 5 Mo)." }, { status: 400 });
  }

  const data = await readClubData();
  const application = data.applications.find((entry) => entry.id === applicationId);
  if (!application) {
    return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
  }

  const bytes = await file.arrayBuffer();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `data/club-documents/staff/${application.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const s3 = createS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || "application/octet-stream",
    }),
  );

  const document = {
    name: label || file.name,
    url: `s3://${bucketName}/${key}`,
    uploadedAt: new Date().toISOString(),
  };
  application.documents.push(document);
  if (application.dossierPhase === "espace_validation") {
    application.dossierPhase = "documents";
  }
  if (application.status === "awaiting_document") {
    application.status = "pending";
  }
  await writeClubData(data);

  return NextResponse.json({ message: "Piece jointe ajoutee.", document });
}
