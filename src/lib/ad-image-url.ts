export type AdImageMeta = {
  format: "jpeg" | "png" | "webp";
  updatedAt: string;
};

export function adImagePublicUrl(
  adId: string,
  image: AdImageMeta | null | undefined,
): string | null {
  if (!image) return null;
  return `/api/ad-images/${encodeURIComponent(adId)}?v=${encodeURIComponent(image.updatedAt)}`;
}
