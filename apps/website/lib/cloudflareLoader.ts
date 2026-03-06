// lib/cloudflareLoader.ts
import { ImageLoaderProps } from "next/image";

export default function cloudflareLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  const cloudflareCdn = "https://cdn.newsramp.app";

  if (src.endsWith(".svg")) return src;

  // 1. Identify Newsramp/Linode Images
  if (src.startsWith(cloudflareCdn) || src.startsWith("/newsworthy/")) {
    // Strip the domain if it exists
    let relativePath = src.startsWith(cloudflareCdn)
      ? src.replace(cloudflareCdn, "")
      : src;

    // FORCE a leading slash if it's missing
    const cleanPath = relativePath.startsWith("/")
      ? relativePath
      : `/${relativePath}`;

    const params = `width=${width},quality=${quality || 75},format=auto`;

    // Return the URL. Note: NO slash between params and cleanPath
    // because cleanPath now definitely has one.
    return `${cloudflareCdn}/cdn-cgi/image/${params}${cleanPath}`;
  }

  // 2. Fallback for Filestack/External
  return src;
}
