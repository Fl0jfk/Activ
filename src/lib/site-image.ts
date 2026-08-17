export const FALLBACK_SITE_IMAGE = "/logo.png";
const SITE_MEDIA_MARKER = "/api/site-media/";

export function resolveSiteImageSrc(url?: string | null, fallback = FALLBACK_SITE_IMAGE): string {
  if (typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  const mediaIndex = trimmed.indexOf(SITE_MEDIA_MARKER);
  if (mediaIndex >= 0) {
    return trimmed.slice(mediaIndex);
  }
  if (trimmed.startsWith("s3://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return fallback;
  }
  return trimmed;
}

export function shouldUnoptimizeSiteImage(url: string): boolean {
  return url.startsWith("/api/") || url.startsWith("http://") || url.startsWith("https://");
}
