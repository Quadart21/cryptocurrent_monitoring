import "server-only";

import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  nextProxyEndpoint,
  proxyAuthConfigured,
  rotateProxyEndpoint,
  type ProxyEndpoint,
} from "@/lib/ai/proxy-pool";

const DEFAULT_BASE = "https://codex.sale/v1";
const FETCH_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 5;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number, is429: boolean): number {
  if (is429) {
    // 3s, 6s, 12s, 20s max — was up to 90s and felt "stuck"
    return Math.min(20_000, 3_000 * 2 ** attempt);
  }
  return Math.min(8_000, 800 * 2 ** attempt);
}

async function readJsonOrThrow(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`${label}: пустой ответ (HTTP ${res.status})`);
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      `${label}: получен HTML вместо JSON (HTTP ${res.status}). Проверьте CODEX_API_BASE и доступность API.`,
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(
      `${label}: невалидный JSON (HTTP ${res.status}): ${trimmed.slice(0, 180)}`,
    );
  }
}

export function codexConfigured(): boolean {
  return Boolean(apiKey());
}

async function resolveProxy(
  preferRotate: boolean,
): Promise<ProxyEndpoint | null> {
  const configured = await proxyAuthConfigured();
  if (!configured) return null;
  return preferRotate ? rotateProxyEndpoint() : nextProxyEndpoint();
}

async function codexFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number; preferDirect?: boolean },
): Promise<Response> {
  const key = apiKey();
  if (!key) {
    throw new Error("CODEX_API_KEY (или CODEX_LB_API_KEY) не задан");
  }
  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  let lastError: unknown;
  let rotateNext = false;
  // Large image responses often break through residential proxies — prefer direct.
  const preferDirect = Boolean(init?.preferDirect);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const useProxy = !preferDirect || attempt > 0;
    const proxy: ProxyEndpoint | null = useProxy
      ? await resolveProxy(rotateNext)
      : null;
    rotateNext = false;

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      };

      let res: Response;
      if (proxy) {
        const agent = new ProxyAgent(proxy.url);
        try {
          // undici fetch + ProxyAgent for HTTP CONNECT through residential/ISP pool
          const raw = (await undiciFetch(`${apiBase()}${path}`, {
            method: init?.method ?? "GET",
            body: init?.body as string | undefined,
            headers,
            signal: controller.signal,
            dispatcher: agent,
          })) as unknown as Response;
          // CRITICAL: fully buffer the body BEFORE closing the proxy agent.
          // Closing early aborts large image payloads mid-stream ("operation was aborted")
          // even though Codex already finished generation successfully.
          const buf = Buffer.from(await raw.arrayBuffer());
          const outHeaders = new Headers();
          raw.headers.forEach((value, name) => {
            outHeaders.set(name, value);
          });
          res = new Response(buf, {
            status: raw.status,
            statusText: raw.statusText,
            headers: outHeaders,
          });
        } finally {
          await agent.close().catch(() => undefined);
        }
      } else {
        res = await fetch(`${apiBase()}${path}`, {
          method: init?.method ?? "GET",
          body: init?.body,
          signal: controller.signal,
          headers,
          cache: "no-store",
        });
      }

      if (res.status === 429 || res.status >= 500) {
        const body = await res.text().catch(() => "");
        lastError = new Error(
          `Codex HTTP ${res.status}${proxy ? ` via ${proxy.host}` : ""}: ${body.slice(0, 200)}`,
        );
        console.warn(
          `[gapsnap] codex ${res.status} attempt ${attempt + 1}/${MAX_RETRIES}${proxy ? ` via ${proxy.host}` : " direct"} — retry`,
        );
        if (res.status === 429) rotateNext = true;
        await sleep(backoffMs(attempt, res.status === 429));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      rotateNext = Boolean(proxy);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[gapsnap] codex fetch error attempt ${attempt + 1}/${MAX_RETRIES}${proxy ? ` via ${proxy.host}` : " direct"}: ${msg.slice(0, 180)}`,
      );
      await sleep(backoffMs(attempt, false));
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
    throw new Error(
      `Не удалось получить модели: HTTP ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const json = (await readJsonOrThrow(res, "listModels")) as {
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
    throw new Error(
      `Chat completion failed: HTTP ${res.status} ${body.slice(0, 300)}`,
    );
  }
  const json = (await readJsonOrThrow(res, "chatCompletion")) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    throw new Error("Пустой ответ модели");
  }
  return String(content).trim();
}

export type GeneratedImage = {
  bytes: Buffer;
  revisedPrompt?: string;
};

/** OpenAI-compatible image generation (codex.sale `/images/generations`). */
export async function generateImage(input: {
  model?: string;
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
}): Promise<GeneratedImage> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Пустой промпт для картинки");

  const model =
    (input.model ?? "").trim() ||
    process.env.CODEX_IMAGE_MODEL?.trim() ||
    "gpt-image-2";

  const res = await codexFetch("/images/generations", {
    method: "POST",
    // Image payloads are large (b64) and often go through residential proxy — allow more time.
    timeoutMs: 300_000,
    preferDirect: true,
    body: JSON.stringify({
      model,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: input.size ?? "1024x1024",
      quality: input.quality ?? "medium",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Image generation failed: HTTP ${res.status} ${body.slice(0, 300)}`,
    );
  }
  const json = (await readJsonOrThrow(res, "generateImage")) as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const item = json.data?.[0];
  if (!item) throw new Error("Пустой ответ image API");

  let bytes: Buffer | null = null;
  if (item.b64_json?.trim()) {
    bytes = Buffer.from(item.b64_json.trim(), "base64");
  } else if (item.url?.trim()) {
    const imgRes = await fetch(item.url.trim(), {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!imgRes.ok) {
      throw new Error(`Не удалось скачать картинку: HTTP ${imgRes.status}`);
    }
    bytes = Buffer.from(await imgRes.arrayBuffer());
  }
  if (!bytes?.length) throw new Error("Image API не вернул данные картинки");

  return {
    bytes,
    revisedPrompt: item.revised_prompt
      ? String(item.revised_prompt).trim()
      : undefined,
  };
}
