import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[1]) {
      const href = match[3]!;
      const label = match[2]!;
      const safe =
        href.startsWith("/") ||
        href.startsWith("https://") ||
        href.startsWith("http://");
      if (safe) {
        nodes.push(
          <a
            key={`a-${key++}`}
            href={href}
            className="text-accent-deep underline-offset-2 hover:underline"
            {...(href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    } else if (match[4]) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold text-ink">
          {match[5]}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-bg-elevated px-1 py-0.5 text-[0.85em]"
        >
          {match[7]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Lightweight markdown for news/blog bodies: headings, lists, paragraphs, links.
 */
export function renderBlogMarkdown(markdown: string): ReactNode {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1]!.length;
      const text = heading[2]!.trim();
      const className =
        level === 1
          ? "font-display text-2xl font-semibold text-ink"
          : level === 2
            ? "font-display text-xl font-semibold text-ink"
            : "font-display text-lg font-semibold text-ink";
      const Tag = (level === 1 ? "h2" : level === 2 ? "h2" : "h3") as
        | "h2"
        | "h3";
      blocks.push(
        <Tag key={`h-${key++}`} className={className}>
          {inlineMarkdown(text)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const m = ordered
          ? cur.match(/^\d+\.\s+(.+)$/)
          : cur.match(/^[-*]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]!.trim());
        i += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`l-${key++}`}
          className={
            ordered
              ? "list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-muted"
              : "list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted"
          }
        >
          {items.map((item, idx) => (
            <li key={idx}>{inlineMarkdown(item)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (
        !cur.trim() ||
        /^(#{1,3})\s+/.test(cur) ||
        /^[-*]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur)
      ) {
        break;
      }
      para.push(cur);
      i += 1;
    }
    blocks.push(
      <p key={`p-${key++}`} className="text-sm leading-relaxed text-ink-muted">
        {inlineMarkdown(para.join(" ").replace(/\s+/g, " ").trim())}
      </p>,
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}
