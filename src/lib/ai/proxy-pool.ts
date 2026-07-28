import "server-only";

const DEFAULT_LIST_URL = "https://super-proxy.net/ruip.html";
const DEFAULT_PORT = 7165;
const LIST_CACHE_MS = 30 * 60 * 1000;

type ProxyPoolState = {
  hosts: string[];
  fetchedAt: number;
  cursor: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapProxyPool: ProxyPoolState | undefined;
}

function pool(): ProxyPoolState {
  if (!globalThis.__gapsnapProxyPool) {
    globalThis.__gapsnapProxyPool = { hosts: [], fetchedAt: 0, cursor: 0 };
  }
  return globalThis.__gapsnapProxyPool;
}

export function proxyAuthConfigured(): boolean {
  return Boolean(
    process.env.CODEX_PROXY_USER?.trim() &&
      process.env.CODEX_PROXY_PASS?.trim(),
  );
}

function proxyPort(): number {
  const raw = Number(process.env.CODEX_PROXY_PORT ?? DEFAULT_PORT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PORT;
}

function hostsFromEnv(): string[] {
  const raw = process.env.CODEX_PROXY_HOSTS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((h) => h.trim())
    .filter((h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h));
}

function parseHostsFromHtml(html: string): string[] {
  const matches = html.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];
  const uniq = new Set<string>();
  for (const ip of matches) {
    const parts = ip.split(".").map(Number);
    if (
      parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ) {
      uniq.add(ip);
    }
  }
  return [...uniq];
}

async function refreshHosts(force = false): Promise<string[]> {
  const state = pool();
  const envHosts = hostsFromEnv();
  if (envHosts.length) {
    state.hosts = envHosts;
    state.fetchedAt = Date.now();
    return state.hosts;
  }

  if (
    !force &&
    state.hosts.length &&
    Date.now() - state.fetchedAt < LIST_CACHE_MS
  ) {
    return state.hosts;
  }

  const listUrl =
    process.env.CODEX_PROXY_LIST_URL?.trim() || DEFAULT_LIST_URL;
  try {
    const res = await fetch(listUrl, {
      cache: "no-store",
      headers: { Accept: "text/html,*/*", "User-Agent": "GapSnapNews/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const hosts = parseHostsFromHtml(html);
    if (hosts.length) {
      state.hosts = hosts;
      state.fetchedAt = Date.now();
      state.cursor = state.cursor % state.hosts.length;
      console.info(`[gapsnap] proxy pool loaded: ${hosts.length} hosts`);
      return state.hosts;
    }
  } catch (err) {
    console.error("[gapsnap] proxy list fetch failed", err);
  }

  return state.hosts;
}

export type ProxyEndpoint = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** http://user:pass@host:port */
  url: string;
};

export async function nextProxyEndpoint(): Promise<ProxyEndpoint | null> {
  if (!proxyAuthConfigured()) return null;
  const hosts = await refreshHosts();
  if (!hosts.length) return null;

  const state = pool();
  const host = hosts[state.cursor % hosts.length]!;
  state.cursor = (state.cursor + 1) % hosts.length;

  const user = process.env.CODEX_PROXY_USER!.trim();
  const pass = process.env.CODEX_PROXY_PASS!.trim();
  const port = proxyPort();
  const url = `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
  return { host, port, user, pass, url };
}

/** Force rotate to next IP (e.g. after 429). Does not re-download the list. */
export async function rotateProxyEndpoint(): Promise<ProxyEndpoint | null> {
  await refreshHosts(false);
  return nextProxyEndpoint();
}
