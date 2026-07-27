import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return null;
  }
  return (
    ((parts[0]! << 24) >>> 0) +
    (parts[1]! << 16) +
    (parts[2]! << 8) +
    parts[3]!
  );
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    if ((n & 0xff000000) === 0x00000000) return true;
    if ((n & 0xff000000) === 0x0a000000) return true;
    if ((n & 0xff000000) === 0x7f000000) return true;
    if ((n & 0xffff0000) === 0xa9fe0000) return true;
    if ((n & 0xfff00000) === 0xac100000) return true;
    if ((n & 0xffff0000) === 0xc0a80000) return true;
    if ((n & 0xffc00000) === 0x64400000) return true;
    if ((n & 0xf0000000) >= 0xe0000000) return true;
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      return isPrivateOrReservedIp(lower.slice("::ffff:".length));
    }
    return false;
  }
  return true;
}

export async function assertSafeOutboundUrl(
  rawUrl: string,
  options?: { allowHttp?: boolean },
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Некорректный URL");
  }

  if (
    url.protocol !== "https:" &&
    !(options?.allowHttp && url.protocol === "http:")
  ) {
    throw new Error("Разрешены только HTTP(S)-ссылки на фиды");
  }
  if (url.username || url.password) {
    throw new Error("URL не должен содержать учётные данные");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    throw new Error("Запрещённый хост фида");
  }

  if (isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error("Запрещённый IP-адрес фида");
    }
    return url;
  }

  let records: { address: string; family: number }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("Не удалось разрешить DNS хоста фида");
  }
  if (!records.length) {
    throw new Error("Хост фида не резолвится");
  }
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error("Хост фида указывает на внутренний адрес");
    }
  }
  return url;
}
