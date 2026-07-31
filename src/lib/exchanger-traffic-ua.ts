/** Edge/client-safe UA summarizer (no server-only imports). */

export function summarizeUserAgent(ua: string): string {
  const s = ua.trim();
  if (!s) return "—";
  if (/bot|crawl|spider|slurp/i.test(s)) return "бот";
  if (/Mobile|Android|iPhone/i.test(s)) {
    if (/iPhone|iPad/i.test(s)) return "iOS";
    if (/Android/i.test(s)) return "Android";
    return "мобильный";
  }
  if (/Windows/i.test(s)) return "Windows";
  if (/Mac OS|Macintosh/i.test(s)) return "macOS";
  if (/Linux/i.test(s)) return "Linux";
  return s.slice(0, 40);
}
