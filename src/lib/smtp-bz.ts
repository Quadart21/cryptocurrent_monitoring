import "server-only";

const API_BASE = "https://api.smtp.bz/v1";

export type SmtpBzSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  toName?: string;
  tag?: string;
  from?: string;
  name?: string;
  reply?: string;
};

function requireApiKey(): string {
  let apiKey = process.env.SMTPBZ_API_KEY?.trim() || "";
  // People often paste "Bearer …" from docs — smtp.bz wants the raw key only.
  if (/^bearer\s+/i.test(apiKey)) {
    apiKey = apiKey.replace(/^bearer\s+/i, "").trim();
  }
  if (!apiKey) throw new Error("SMTPBZ_API_KEY не задан");
  return apiKey;
}

async function smtpFetch(
  path: string,
  init?: RequestInit & { form?: FormData },
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", requireApiKey());
  headers.set("Accept", "application/json");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init?.form ?? init?.body,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function sendSmtpBzEmail(
  input: SmtpBzSendInput,
): Promise<{ raw: string }> {
  const from = (input.from ?? process.env.SMTPBZ_FROM)?.trim();
  const name =
    (input.name ?? process.env.SMTPBZ_FROM_NAME)?.trim() || "GapSnap";
  if (!from) throw new Error("SMTPBZ_FROM / fromEmail не задан");

  const body = new FormData();
  body.set("from", from);
  body.set("name", name);
  body.set("subject", input.subject);
  body.set("to", input.to);
  body.set("html", input.html);
  if (input.text) body.set("text", input.text);
  if (input.toName) body.set("to_name", input.toName);
  if (input.tag) body.set("tag", input.tag);
  if (input.reply) body.set("reply", input.reply);

  const res = await smtpFetch("/smtp/send", { method: "POST", form: body });
  if (!res.ok) {
    throw new Error(
      `smtp.bz ошибка ${res.status}${res.text ? `: ${res.text.slice(0, 200)}` : ""}`,
    );
  }
  return { raw: res.text };
}

export async function smtpBzGetUser() {
  return smtpFetch("/user");
}

export async function smtpBzGetStats() {
  return smtpFetch("/user/stats");
}

export async function smtpBzGetDomains() {
  return smtpFetch("/user/domain");
}

export async function smtpBzGetMessages(query: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return smtpFetch(`/log/message${suffix}`);
}

export async function smtpBzGetMessage(id: string) {
  return smtpFetch(`/log/message/${encodeURIComponent(id)}`);
}

export async function smtpBzCheckEmail(email: string) {
  return smtpFetch(`/check/email/${encodeURIComponent(email)}`);
}

export async function smtpBzListUnsubscribe(query: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return smtpFetch(`/unsubscribe${suffix}`);
}

export async function smtpBzAddUnsubscribe(addresses: string) {
  const form = new FormData();
  form.set("address", addresses);
  return smtpFetch("/unsubscribe/add", { method: "POST", form });
}

export async function smtpBzRemoveUnsubscribe(address: string) {
  const form = new FormData();
  form.set("address", address);
  return smtpFetch("/unsubscribe/remove", { method: "POST", form });
}

export function smtpBzConfigured(): boolean {
  return Boolean(
    process.env.SMTPBZ_API_KEY?.trim() && process.env.SMTPBZ_FROM?.trim(),
  );
}

export function smtpBzConfigStatus() {
  return {
    hasApiKey: Boolean(process.env.SMTPBZ_API_KEY?.trim()),
    hasFromEnv: Boolean(process.env.SMTPBZ_FROM?.trim()),
    fromEnv: process.env.SMTPBZ_FROM?.trim() || null,
    fromNameEnv: process.env.SMTPBZ_FROM_NAME?.trim() || null,
  };
}
