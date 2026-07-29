import { logoPublicUrl } from "@/lib/logo-url";
import type { ExchangerLogo } from "@/lib/store-types";

export function ExchangerLogoMark({
  name,
  logo,
  exchangerId,
  size = 44,
  className = "",
}: {
  name: string;
  exchangerId: string;
  logo?: ExchangerLogo | null;
  size?: number;
  className?: string;
}) {
  const src = logoPublicUrl(exchangerId, logo);
  const letter = (name?.trim() || "?").slice(0, 1).toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 flex-none rounded-2xl object-contain bg-bg-soft ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
        }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 flex-none items-center justify-center rounded-xl bg-accent text-sm font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
      aria-hidden
    >
      {letter}
    </div>
  );
}
