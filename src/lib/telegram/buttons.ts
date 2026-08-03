import type {
  TelegramButtonRow,
  TelegramUrlButton,
} from "@/lib/telegram/types";

const MAX_ROWS = 8;
const MAX_PER_ROW = 8;
const MAX_TEXT = 64;

export function normalizeTelegramButtons(
  raw: unknown,
): TelegramButtonRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: TelegramButtonRow[] = [];

  for (const row of raw.slice(0, MAX_ROWS)) {
    // Flat list of buttons → one row each
    if (
      row &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      "text" in row &&
      "url" in row
    ) {
      const btn = normalizeButton(row);
      if (btn) rows.push([btn]);
      continue;
    }
    if (!Array.isArray(row)) continue;
    const buttons: TelegramUrlButton[] = [];
    for (const cell of row.slice(0, MAX_PER_ROW)) {
      const btn = normalizeButton(cell);
      if (btn) buttons.push(btn);
    }
    if (buttons.length) rows.push(buttons);
  }

  return rows;
}

function normalizeButton(raw: unknown): TelegramUrlButton | null {
  if (!raw || typeof raw !== "object") return null;
  const text = String((raw as { text?: unknown }).text ?? "")
    .trim()
    .slice(0, MAX_TEXT);
  const url = String((raw as { url?: unknown }).url ?? "").trim();
  if (!text || !url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { text, url };
}

export function telegramReplyMarkup(
  buttons: TelegramButtonRow[] | undefined,
): { inline_keyboard: Array<Array<{ text: string; url: string }>> } | undefined {
  const rows = normalizeTelegramButtons(buttons ?? []);
  if (!rows.length) return undefined;
  return {
    inline_keyboard: rows.map((row) =>
      row.map((b) => ({ text: b.text, url: b.url })),
    ),
  };
}

/** Empty keyboard removes buttons on edit. */
export function telegramReplyMarkupOrClear(
  buttons: TelegramButtonRow[] | undefined,
): { inline_keyboard: Array<Array<{ text: string; url: string }>> } {
  return (
    telegramReplyMarkup(buttons) ?? {
      inline_keyboard: [],
    }
  );
}
