import "server-only";

import { DEFAULT_PROXY_PORT } from "@/lib/ai/default-proxies";
import { getNewsSettings } from "@/lib/store";

type ProxyPoolState = {
  hosts: string[];
  user: string;
  pass: string;
  port: number;
  enabled: boolean;
  loadedAt: number;
  cursor: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapProxyPool: ProxyPoolState | undefined;
}

function pool(): ProxyPoolState {
  if (!globalThis.__gapsnapProxyPool) {
    globalThis.__gapsnapProxyPool = {
      hosts: [],
      user: "",
      pass: "",
      port: DEFAULT_PROXY_PORT,
      enabled: false,
      loadedAt: 0,
      cursor: 0,
    };
  }
  return globalThis.__gapsnapProxyPool;
}

export function resetProxyPool(): void {
  globalThis.__gapsnapProxyPool = {
    hosts: [],
    user: "",
    pass: "",
    port: DEFAULT_PROXY_PORT,
    enabled: false,
    loadedAt: 0,
    cursor: 0,
  };
}

async function loadPool(force = false): Promise<ProxyPoolState> {
  const state = pool();
  if (!force && state.loadedAt && Date.now() - state.loadedAt < 5_000) {
    return state;
  }

  const settings = await getNewsSettings();
  // Env can still override credentials if DB empty
  const user =
    settings.proxyUser.trim() ||
    process.env.CODEX_PROXY_USER?.trim() ||
    "";
  const pass =
    settings.proxyPass || process.env.CODEX_PROXY_PASS?.trim() || "";
  const port =
    settings.proxyPort > 0
      ? settings.proxyPort
      : Number(process.env.CODEX_PROXY_PORT ?? DEFAULT_PROXY_PORT) ||
        DEFAULT_PROXY_PORT;
  const hosts =
    settings.proxyHostList.length > 0
      ? settings.proxyHostList
      : (process.env.CODEX_PROXY_HOSTS ?? "")
          .split(/[\s,;]+/)
          .map((h) => h.trim())
          .filter(Boolean);

  state.enabled = Boolean(settings.proxyEnabled && user && pass && hosts.length);
  state.user = user;
  state.pass = pass;
  state.port = port;
  state.hosts = hosts;
  state.loadedAt = Date.now();
  if (state.hosts.length) {
    state.cursor = state.cursor % state.hosts.length;
  }
  return state;
}

export async function proxyAuthConfigured(): Promise<boolean> {
  const state = await loadPool();
  return state.enabled;
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
  const state = await loadPool();
  if (!state.enabled || !state.hosts.length) return null;

  const host = state.hosts[state.cursor % state.hosts.length]!;
  state.cursor = (state.cursor + 1) % state.hosts.length;

  const url = `http://${encodeURIComponent(state.user)}:${encodeURIComponent(state.pass)}@${host}:${state.port}`;
  return {
    host,
    port: state.port,
    user: state.user,
    pass: state.pass,
    url,
  };
}

/** Auto-rotate to next IP (e.g. after 429). */
export async function rotateProxyEndpoint(): Promise<ProxyEndpoint | null> {
  return nextProxyEndpoint();
}
