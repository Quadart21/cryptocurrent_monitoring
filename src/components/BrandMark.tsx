import Image from "next/image";
import { DEFAULT_BRAND_LOGO_PATH } from "@/lib/branding-url";

type BrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  /** Custom logo URL from branding uploads; falls back to default mark. */
  src?: string | null;
};

/** Site brand mark — custom upload or default GapSnap PNG. */
export function BrandMark({
  size = 36,
  className = "",
  priority = false,
  src,
}: BrandMarkProps) {
  const imageSrc = src?.trim() || DEFAULT_BRAND_LOGO_PATH;
  return (
    <Image
      src={imageSrc}
      alt="GapSnap"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      priority={priority}
      unoptimized={imageSrc.startsWith("/api/")}
    />
  );
}
