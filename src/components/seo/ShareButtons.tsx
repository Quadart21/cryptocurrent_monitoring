"use client";

import { useMemo, useState } from "react";

type Props = {
  title: string;
  url?: string;
  text?: string;
};

export function ShareButtons({ title, url, text }: Props) {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (url) return url;
    if (typeof window !== "undefined") return window.location.href;
    return "";
  }, [url]);

  const encoded = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(text || title);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  if (!shareUrl) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-ink-muted">Поделиться:</span>
      <a
        href={`https://t.me/share/url?url=${encoded}&text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-accent/40 hover:text-ink"
      >
        Telegram
      </a>
      <a
        href={`https://vk.com/share.php?url=${encoded}&title=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-accent/40 hover:text-ink"
      >
        VK
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-accent/40 hover:text-ink"
      >
        X
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-accent/40 hover:text-ink"
      >
        {copied ? "Скопировано" : "Ссылка"}
      </button>
    </div>
  );
}
