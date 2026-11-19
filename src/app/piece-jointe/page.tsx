import type { Metadata } from "next";
import PublicDocumentUploadForm from "@/components/public-document-upload-form";
import { NOINDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = { title: "Envoi de pièce jointe", ...NOINDEX_METADATA };

export default async function PieceJointePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <PublicDocumentUploadForm token={params.token ?? ""} />;
}
