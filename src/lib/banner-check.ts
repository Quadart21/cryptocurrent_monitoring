import "server-only";

import type { BannerCheckJson } from "@/db/schema";
import {
  emptyBannerCheck,
  bannerEmbedHtml,
  htmlHasGapSnapBanner,
  normalizeBannerCheck,
} from "@/lib/banner";
import { sendRawAdminEmail, siteBaseUrl } from "@/lib/email/service";
import {
  extractEmail,
  sendOwnerBannerMissingEmail,
  sendOwnerBannerUnpublishedEmail,
} from "@/lib/owner-mail";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { resendConfigured } from "@/lib/resend-mail";
import {
  ensureBannerToken,
  getExchangerById,
  getSeoSettings,
  listExchangers,
  updateBannerCheck,
  updateExchanger,
  type FeedExchanger,
} from "@/lib/store";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2_500_000;
const FETCH_CONCURRENCY = 3;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const START_DELAY_MS = 45_000;

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapBannerPollerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapBannerCheckInFlight: Promise<BannerCheckRunResult> | null | undefined;
}

export type BannerCheckRunResult = {
  checked: number;
  ok: number;
  missing: number;
  errors: number;
  notified: boolean;
  checkedAt: string;
};

function intervalMs(): number {
  const raw = Number(process.env.BANNER_CHECK_INTERVAL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_INTERVAL_MS;
}

function adminAlertEmail(): string {
  return (process.env.ADMIN_ALERT_EMAIL ?? "").trim().toLowerCase();
}

async function fetchHtml(url: string): Promise<string> {
  let current = await assertSafeOutboundUrl(url, { allowHttp: true });

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "User-Agent": "GapSnapBannerCheck/1.0 (+https://gapsnap.org)",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) throw new Error("Редирект без Location");
        if (hop === MAX_REDIRECTS) throw new Error("Слишком много редиректов");
        const next = new URL(location, current);
        current = await assertSafeOutboundUrl(next.toString(), { allowHttp: true });
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const lengthHeader = res.headers.get("content-length");
      if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
        throw new Error("Страница слишком большая");
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BODY_BYTES) throw new Error("Страница слишком большая");
      return buf.toString("utf8");
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Не удалось загрузить сайт");
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => run()),
  );
  return results;
}

export async function checkExchangerBanner(
  exchanger: FeedExchanger,
  options?: { siteUrl?: string },
): Promise<BannerCheckJson> {
  const ensured = (await ensureBannerToken(exchanger.id)) ?? exchanger;
  const token = ensured.bannerToken;
  const prev = normalizeBannerCheck(ensured.bannerCheck);
  const now = new Date().toISOString();

  if (!token) {
    const next: BannerCheckJson = {
      ...emptyBannerCheck(),
      status: "error",
      lastCheckAt: now,
      lastError: "Нет токена баннера",
      consecutiveMisses: prev.consecutiveMisses,
      lastSeenAt: prev.lastSeenAt,
      missingSince: prev.missingSince,
      lastNotifiedAt: prev.lastNotifiedAt,
      lastOwnerWarnedAt: prev.lastOwnerWarnedAt,
      ownerWarnCount: prev.ownerWarnCount,
    };
    await updateBannerCheck(ensured.id, next);
    return next;
  }

  if (!ensured.website?.trim()) {
    const next: BannerCheckJson = {
      ...prev,
      status: "error",
      lastCheckAt: now,
      lastError: "Не указан сайт обменника",
      consecutiveMisses: prev.consecutiveMisses + 1,
      missingSince: prev.missingSince ?? now,
    };
    await updateBannerCheck(ensured.id, next);
    return next;
  }

  try {
    const html = await fetchHtml(ensured.website);
    const siteUrl =
      options?.siteUrl ?? siteBaseUrl((await getSeoSettings()).siteUrl);
    if (
      htmlHasGapSnapBanner(html, token, {
        slug: ensured.slug,
        siteUrl,
      })
    ) {
      const next: BannerCheckJson = {
        status: "ok",
        lastCheckAt: now,
        lastSeenAt: now,
        missingSince: null,
        consecutiveMisses: 0,
        lastError: null,
        lastNotifiedAt: prev.lastNotifiedAt,
        lastOwnerWarnedAt: prev.lastOwnerWarnedAt,
        ownerWarnCount: prev.ownerWarnCount,
      };
      await updateBannerCheck(ensured.id, next);
      return next;
    }

    const next: BannerCheckJson = {
      status: "missing",
      lastCheckAt: now,
      lastSeenAt: prev.lastSeenAt,
      missingSince: prev.missingSince ?? now,
      consecutiveMisses: prev.consecutiveMisses + 1,
      lastError: null,
      lastNotifiedAt: prev.lastNotifiedAt,
      lastOwnerWarnedAt: prev.lastOwnerWarnedAt,
      ownerWarnCount: prev.ownerWarnCount,
    };
    await updateBannerCheck(ensured.id, next);
    return next;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ошибка проверки баннера";
    const next: BannerCheckJson = {
      status: "error",
      lastCheckAt: now,
      lastSeenAt: prev.lastSeenAt,
      missingSince: prev.missingSince ?? now,
      consecutiveMisses: prev.consecutiveMisses + 1,
      lastError: message,
      lastNotifiedAt: prev.lastNotifiedAt,
      lastOwnerWarnedAt: prev.lastOwnerWarnedAt,
      ownerWarnCount: prev.ownerWarnCount,
    };
    await updateBannerCheck(ensured.id, next);
    return next;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function notifyAdminMissing(missing: FeedExchanger[]): Promise<boolean> {
  const to = adminAlertEmail();
  if (!to || missing.length === 0) return false;
  if (!resendConfigured()) {
    console.warn("[gapsnap] banner missing, but SMTP not configured — skip admin email");
    return false;
  }

  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  const bodyLines = missing.map((ex) => {
    const check = normalizeBannerCheck(ex.bannerCheck);
    const err = check.lastError ? ` — ${check.lastError}` : "";
    const publicUrl = `${base}/exchangers/${encodeURIComponent(ex.slug)}`;
    return `• <strong>${escapeHtml(ex.name)}</strong> — <a href="${escapeHtml(ex.website)}">${escapeHtml(ex.website)}</a>${escapeHtml(err)}<br/><span style="font-size:12px;color:#555"><a href="${escapeHtml(publicUrl)}">${escapeHtml(publicUrl)}</a></span>`;
  });

  await sendRawAdminEmail({
    to,
    subject: `GapSnap: баннер не найден у ${missing.length} обменник(ов)`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p>Суточная проверка размещения баннера GapSnap:</p>
  <p><strong>${missing.length}</strong> активных обменников без кнопки на сайте.</p>
  <ul>${bodyLines.map((l) => `<li style="margin:8px 0">${l}</li>`).join("")}</ul>
  <p style="font-size:13px;color:#555">Напомните владельцам вставить HTML-код баннера из кабинета /cabinet.</p>
</div>`,
    text: `Баннер GapSnap не найден:\n\n${missing
      .map((ex) => {
        const check = normalizeBannerCheck(ex.bannerCheck);
        return `- ${ex.name}: ${ex.website}${check.lastError ? ` (${check.lastError})` : ""}`;
      })
      .join("\n")}`,
    tag: "banner-missing",
  });
  return true;
}

export async function runBannerChecks(options?: {
  exchangerId?: string;
}): Promise<BannerCheckRunResult> {
  if (globalThis.__gapsnapBannerCheckInFlight && !options?.exchangerId) {
    return globalThis.__gapsnapBannerCheckInFlight;
  }

  const run = (async (): Promise<BannerCheckRunResult> => {
    const all = await listExchangers();
    const targets = all.filter((e) => {
      if (options?.exchangerId) return e.id === options.exchangerId;
      return e.status === "active";
    });
    const siteUrl = siteBaseUrl((await getSeoSettings()).siteUrl);

    await mapPool(targets, FETCH_CONCURRENCY, async (ex) => {
      await checkExchangerBanner(ex, { siteUrl });
    });

    const refreshed = await listExchangers();
    const after = options?.exchangerId
      ? refreshed.filter((e) => e.id === options.exchangerId)
      : refreshed.filter((e) => e.status === "active");

    let ok = 0;
    let missing = 0;
    let errors = 0;
    const missingList: FeedExchanger[] = [];
    for (const ex of after) {
      const st = normalizeBannerCheck(ex.bannerCheck).status;
      if (st === "ok") ok += 1;
      else if (st === "missing") {
        missing += 1;
        missingList.push(ex);
      } else if (st === "error") {
        errors += 1;
        missingList.push(ex);
      }
    }

    const toNotify = missingList.filter((ex) => {
      const check = normalizeBannerCheck(ex.bannerCheck);
      if (check.status !== "missing" && check.status !== "error") return false;
      if (!check.lastNotifiedAt) return true;
      return check.lastNotifiedAt.slice(0, 10) !== new Date().toISOString().slice(0, 10);
    });

    let notified = false;
    if (toNotify.length > 0 && !options?.exchangerId) {
      try {
        notified = await notifyAdminMissing(toNotify);
        if (notified) {
          const now = new Date().toISOString();
          await Promise.all(
            toNotify.map(async (ex) => {
              await updateBannerCheck(ex.id, {
                ...normalizeBannerCheck(ex.bannerCheck),
                lastNotifiedAt: now,
              });
            }),
          );
        }
      } catch (err) {
        console.error("[gapsnap] banner admin notify failed", err);
      }
    }

    const result: BannerCheckRunResult = {
      checked: targets.length,
      ok,
      missing,
      errors,
      notified,
      checkedAt: new Date().toISOString(),
    };
    console.info(
      `[gapsnap] banner check: checked=${result.checked} ok=${result.ok} missing=${result.missing} errors=${result.errors} notified=${result.notified}`,
    );
    return result;
  })().finally(() => {
    if (!options?.exchangerId) globalThis.__gapsnapBannerCheckInFlight = null;
  });

  if (!options?.exchangerId) globalThis.__gapsnapBannerCheckInFlight = run;
  return run;
}

export function startBannerCheckPoller(): void {
  if (globalThis.__gapsnapBannerPollerStarted) return;
  globalThis.__gapsnapBannerPollerStarted = true;
  const ms = intervalMs();
  const tick = () => {
    void runBannerChecks().catch((error) => {
      console.error("[gapsnap] banner check failed", error);
    });
  };
  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, ms);
  console.info(
    `[gapsnap] banner check poller started (every ${Math.round(ms / 3_600_000)}h)`,
  );
}

async function ownerBannerHtml(ex: FeedExchanger): Promise<string> {
  const ensured = (await ensureBannerToken(ex.id)) ?? ex;
  const seo = await getSeoSettings();
  const token = ensured.bannerToken;
  if (!token) {
    return "Код появится в кабинете после генерации токена.";
  }
  return bannerEmbedHtml({
    siteUrl: siteBaseUrl(seo.siteUrl),
    token,
    slug: ensured.slug,
  });
}

function resolveOwnerEmail(ex: FeedExchanger): string | null {
  return ex.ownerEmail?.trim().toLowerCase() || extractEmail(ex.contact);
}

export type BannerOwnerActionResult = {
  ok: boolean;
  exchangerId: string;
  error?: string;
  mailed?: boolean;
  mailTo?: string | null;
};

/** Send warning email to exchanger owner about missing GapSnap badge. */
export async function warnOwnerBannerMissing(
  exchangerId: string,
): Promise<BannerOwnerActionResult> {
  const ex = await getExchangerById(exchangerId);
  if (!ex) {
    return { ok: false, exchangerId, error: "Обменник не найден" };
  }

  const to = resolveOwnerEmail(ex);
  if (!to) {
    return {
      ok: false,
      exchangerId,
      error: "Нет email владельца (ownerEmail / contact)",
    };
  }
  if (!resendConfigured()) {
    return { ok: false, exchangerId, error: "SMTP не настроен" };
  }

  const check = normalizeBannerCheck(ex.bannerCheck);
  const bannerHtml = await ownerBannerHtml(ex);

  try {
    await sendOwnerBannerMissingEmail({
      to,
      exchangerName: ex.name,
      website: ex.website || "—",
      bannerHtml,
      misses: check.consecutiveMisses,
    });
  } catch (error) {
    return {
      ok: false,
      exchangerId,
      error: error instanceof Error ? error.message : "Ошибка отправки",
    };
  }

  const now = new Date().toISOString();
  await updateBannerCheck(ex.id, {
    ...check,
    lastOwnerWarnedAt: now,
    ownerWarnCount: check.ownerWarnCount + 1,
  });

  return { ok: true, exchangerId, mailed: true, mailTo: to };
}

/** Unpublish exchanger (rejected) for missing banner; optionally email owner. */
export async function unpublishForMissingBanner(
  exchangerId: string,
  options?: { notifyOwner?: boolean },
): Promise<BannerOwnerActionResult & { warning?: string }> {
  const ex = await getExchangerById(exchangerId);
  if (!ex) {
    return { ok: false, exchangerId, error: "Обменник не найден" };
  }
  if (ex.status !== "active" && ex.status !== "error") {
    return {
      ok: false,
      exchangerId,
      error: `Статус уже «${ex.status}» — снятие не нужно`,
    };
  }

  const notifyOwner = options?.notifyOwner !== false;
  const to = resolveOwnerEmail(ex);
  let mailed = false;
  let warning: string | undefined;

  if (notifyOwner) {
    if (!to) {
      warning = "Снято без письма: нет email владельца";
    } else if (!resendConfigured()) {
      warning = "Снято без письма: SMTP не настроен";
    } else {
      try {
        await sendOwnerBannerUnpublishedEmail({
          to,
          exchangerName: ex.name,
          website: ex.website || "—",
          bannerHtml: await ownerBannerHtml(ex),
        });
        mailed = true;
      } catch (error) {
        warning = `Снято, но письмо не ушло: ${
          error instanceof Error ? error.message : "ошибка"
        }`;
      }
    }
  }

  const updated = await updateExchanger(ex.id, { status: "rejected" });
  if (!updated) {
    return { ok: false, exchangerId, error: "Не удалось обновить статус" };
  }

  if (mailed) {
    const check = normalizeBannerCheck(updated.bannerCheck);
    await updateBannerCheck(ex.id, {
      ...check,
      lastOwnerWarnedAt: new Date().toISOString(),
      ownerWarnCount: check.ownerWarnCount + 1,
    });
  }

  return { ok: true, exchangerId, mailed, mailTo: to, warning };
}
