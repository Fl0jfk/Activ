import { NextResponse } from "next/server";

function asciiFileName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_").trim() || "document";
}

/**
 * Réponse sûre pour servir un document déposé par un tiers : type déterminé par le serveur,
 * `nosniff`, téléchargement forcé sauf PDF et images, et bac à sable pour tout ce qui n'est pas un PDF.
 */
export function clubDocumentResponse(
  document: { body: Buffer; contentType: string; inline: boolean },
  fileName: string,
  options?: { forceDownload?: boolean },
): NextResponse {
  const inline = document.inline && !options?.forceDownload;
  const cleanName = fileName.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || "document";
  const headers: Record<string, string> = {
    "Content-Type": document.contentType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFileName(cleanName)}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, max-age=60",
  };
  // Le lecteur PDF de certains navigateurs refuse les documents en bac à sable.
  if (document.contentType !== "application/pdf") {
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
  }
  return new NextResponse(new Uint8Array(document.body), { status: 200, headers });
}
