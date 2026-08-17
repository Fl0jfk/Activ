import Image, { type ImageProps } from "next/image";
import { resolveSiteImageSrc, shouldUnoptimizeSiteImage } from "@/lib/site-image";

type SiteImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
};

export default function SiteImage({ src, alt, unoptimized, ...props }: SiteImageProps) {
  const resolved = resolveSiteImageSrc(typeof src === "string" ? src : "");
  return (
    <Image
      {...props}
      src={resolved}
      alt={alt}
      unoptimized={unoptimized || shouldUnoptimizeSiteImage(resolved)}
    />
  );
}
