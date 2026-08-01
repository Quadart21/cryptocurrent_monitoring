/** Shared helpers for public site contact (email / Telegram). */

export function normalizeTelegramHandle(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\/t\.me\//i.test(t)) {
    return t.replace(/^https?:\/\/t\.me\//i, "").replace(/\/+$/, "").split(/[?#]/)[0] ?? "";
  }
  return t.replace(/^@/, "").trim();
}

export function telegramHref(raw: string): string | null {
  const handle = normalizeTelegramHandle(raw);
  if (!handle) return null;
  return `https://t.me/${handle}`;
}

export function telegramDisplay(raw: string): string {
  const handle = normalizeTelegramHandle(raw);
  return handle ? `@${handle}` : "";
}

export function contactHref(contact: string): string | null {
  const c = contact.trim();
  if (!c) return null;
  if (c.includes("@") && !c.startsWith("@")) return `mailto:${c}`;
  if (c.startsWith("@") || /^https?:\/\/t\.me\//i.test(c)) {
    return telegramHref(c);
  }
  if (c.startsWith("http")) return c;
  return `mailto:${c}`;
}

/** Prefer ad override, then site email, then Telegram. */
export function resolvePublicContact(input: {
  override?: string | null;
  contactEmail?: string | null;
  contactTelegram?: string | null;
}): string {
  const override = (input.override ?? "").trim();
  if (override) return override;
  const email = (input.contactEmail ?? "").trim();
  if (email) return email;
  const tg = telegramDisplay(input.contactTelegram ?? "");
  return tg;
}
