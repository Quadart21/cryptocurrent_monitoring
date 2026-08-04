import "server-only";

const API_BASE = "https://pay.xrocket.exchange";
const REQUEST_TIMEOUT_MS = 20_000;

export type XrocketTransferResult = {
  id: number;
  tgUserId: number;
  currency: string;
  amount: number;
  description?: string;
};

export type XrocketAppInfo = {
  name: string;
  feePercents: number;
  balances: Array<{ currency: string; balance: number }>;
};

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; message?: string };

async function callXrocket<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const key = apiKey.trim();
  if (!key) throw new Error("xRocket Pay key не задан");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Rocket-Pay-Key": key,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`xRocket Pay не ответил за ${REQUEST_TIMEOUT_MS / 1000}с`);
    }
    throw new Error(
      error instanceof Error
        ? `Сеть xRocket: ${error.message}`
        : "Сеть xRocket недоступна",
    );
  } finally {
    clearTimeout(timer);
  }

  let data: ApiOk<T> | ApiErr;
  try {
    data = (await res.json()) as ApiOk<T> | ApiErr;
  } catch {
    throw new Error(`xRocket Pay вернул не-JSON (HTTP ${res.status})`);
  }

  if (!data.success) {
    throw new Error(
      (data as ApiErr).message?.trim() ||
        `xRocket Pay error HTTP ${res.status}`,
    );
  }
  return (data as ApiOk<T>).data;
}

export async function xrocketGetAppInfo(
  apiKey: string,
): Promise<XrocketAppInfo> {
  return callXrocket<XrocketAppInfo>(apiKey, "GET", "/app/info");
}

export async function xrocketTransfer(
  apiKey: string,
  input: {
    tgUserId: number;
    currency: string;
    amount: number;
    transferId: string;
    description?: string;
  },
): Promise<XrocketTransferResult> {
  return callXrocket<XrocketTransferResult>(apiKey, "POST", "/app/transfer", {
    tgUserId: input.tgUserId,
    currency: input.currency,
    amount: input.amount,
    transferId: input.transferId,
    description: input.description,
  });
}

export function maskSecret(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (t.length <= 10) return "••••••••";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
