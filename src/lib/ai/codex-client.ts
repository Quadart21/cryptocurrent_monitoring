import "server-only";

const DEFAULT_BASE = "https://codex.sale/v1";
const FETCH_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;

export type CodexModel = {
  id: string;
  ownedBy?: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function apiKey(): string {
  return (
    process.env.CODEX_API_KEY?.trim() ||
    process.env.CODEX_LB_API_KEY?.trim() ||
    ""
  );
}

function apiBase(): string {
  const raw = (process.env.CODEX_API_BASE ?? DEFAULT_BASE).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_BASE;
}

export function codexConfigured(): boolean {
  return Boolean(apiKey());
}

async function codexFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const key = apiKey();
  if (!key) {
    throw new Error("CODEX_API_KEY (или CODEX_LB_API_KEY) не задан");
  }
  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${apiBase()}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text().catch(() => "");
        lastError = new Error(`Codex HTTP ${res.status}: ${body.slice(0, 200)}`);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Codex request failed");
}

export async function listCodexModels(): Promise<CodexModel[]> {
  const res = await codexFetch("/models", { method: "GET", timeoutMs: 30_000 });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Не удалось получить модели: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ id?: string; owned_by?: string }>;
  };
  const models = (json.data ?? [])
    .map((m) => ({
      id: String(m.id ?? "").trim(),
      ownedBy: m.owned_by ? String(m.owned_by) : undefined,
    }))
    .filter((m) => m.id);
  models.sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

export async function chatCompletion(input: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<string> {
  const model = input.model.trim();
  if (!model) throw new Error("Модель не выбрана");
  const res = await codexFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Chat completion failed: HTTP ${res.status} ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    throw new Error("Пустой ответ модели");
  }
  return String(content).trim();
}
