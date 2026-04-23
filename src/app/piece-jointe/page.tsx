import PublicDocumentUploadForm from "@/components/public-document-upload-form";

export default async function PieceJointePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <PublicDocumentUploadForm token={params.token ?? ""} />;
}
