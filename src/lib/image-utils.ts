import type { ImageConfig } from "./types"

export function resolveImageUrl(
  filename: string,
  imageConfig: ImageConfig | null,
): string {
  if (!filename) return filename
  if (filename.startsWith("http://") || filename.startsWith("https://")) return filename
  if (filename.startsWith("/")) return filename
  if (!imageConfig?.base_url) return filename
  return `${imageConfig.base_url}/${filename}`
}
