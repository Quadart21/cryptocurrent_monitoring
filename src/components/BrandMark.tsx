import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** GapSnap mark — generated brand PNG with transparent background. */
export function BrandMark({
  size = 36,
  className = "",
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src="/gapsnap-mark.png"
      alt="GapSnap"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      priority={priority}
    />
  );
}
