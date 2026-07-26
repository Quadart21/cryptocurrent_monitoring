import type { ExchangerAchievement } from "@/lib/store-types";

type Badge = Pick<ExchangerAchievement, "id" | "name" | "description" | "svg">;

function prepareSvg(svg: string): string {
  const trimmed = svg.trim();
  if (!trimmed) return "";
  // Ensure the icon fills the badge box; drop nested <title> so our tooltip wins.
  return trimmed
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
      let next = attrs;
      if (!/\bwidth\s*=/i.test(next)) next += ` width="100%"`;
      if (!/\bheight\s*=/i.test(next)) next += ` height="100%"`;
      if (!/\bpreserveAspectRatio\s*=/i.test(next)) {
        next += ` preserveAspectRatio="xMidYMid meet"`;
      }
      return `<svg${next}>`;
    });
}

export function AchievementBadges({
  achievements,
  size = 18,
  className = "",
}: {
  achievements: Badge[];
  size?: number;
  className?: string;
}) {
  if (!achievements.length) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 align-middle ${className}`}
      aria-label="Ачивки"
    >
      {achievements.map((a) => {
        const html = prepareSvg(a.svg);
        return (
          <span
            key={a.id}
            title={a.description || a.name}
            aria-label={a.description ? `${a.name}: ${a.description}` : a.name}
            className="inline-flex shrink-0 items-center justify-center text-accent-deep [&_svg]:block [&_svg]:max-h-full [&_svg]:max-w-full"
            style={{ width: size, height: size }}
          >
            {html ? (
              <span
                className="flex size-full items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <span className="flex size-full items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold">
                {a.name.slice(0, 1)}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
