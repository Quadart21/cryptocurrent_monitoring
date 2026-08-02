"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { FeedExchanger } from "@/lib/store-types";
import type { AdminExchanger } from "@/components/admin/types";
import {
  bannerEmbedHtml,
  bannerStatusLabel,
} from "@/lib/banner";
import { formatOutboundCtr } from "@/lib/exchanger-traffic";
import { logoPublicUrl } from "@/lib/logo-url";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { useAdmin } from "@/components/admin/AdminProvider";
import {
  AdminPageHeader,
  AdminSection,
  AdminTabBar,
  StatusPill,
} from "@/components/admin/ui";
import { TrafficEventsPanel } from "@/components/TrafficEventsPanel";

type DetailTab =
  | "overview"
  | "edit"
  | "banner"
  | "cabinet"
  | "achievements"
  | "traffic"
  | "reviews";

type EditForm = {
  name: string;
  website: string;
  exchangeUrlTemplate: string;
  feedUrl: string;
  contact: string;
  description: string;
};

function formFromEx(ex: FeedExchanger | AdminExchanger): EditForm {
  return {
    name: ex.name,
    website: ex.website,
    exchangeUrlTemplate: ex.exchangeUrlTemplate ?? "",
    feedUrl: ex.feedUrl,
    contact: ex.contact,
    description: ex.description,
  };
}

export function ExchangerDetailModule() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id ?? "");
  const { overview, busy, setBusy, refresh, can } = useAdmin();
  const canWrite = can("exchangers.write");

  const ex = useMemo(
    () => overview?.exchangers.find((e) => e.id === id) ?? null,
    [overview, id],
  );
  const achievements = overview?.achievements ?? [];
  const reviews = useMemo(
    () => (overview?.reviews ?? []).filter((r) => r.exchangerId === id),
    [overview, id],
  );

  const [form, setForm] = useState<EditForm | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [syncAfterSave, setSyncAfterSave] = useState(false);
  const [ownerLogin, setOwnerLogin] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerOk, setOwnerOk] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");

  useEffect(() => {
    if (ex) {
      setForm(formFromEx(ex));
      setLogoFile(null);
      setEditError(null);
      setOwnerLogin(ex.ownerLogin ?? "");
      setOwnerPassword("");
      setOwnerError(null);
      setOwnerOk(false);
      setBannerMsg(null);
      setInviteMsg(null);
    }
  }, [ex]);

  async function sendInvite(force: boolean) {
    if (!ex || !canWrite) return;
    if (
      force &&
      !window.confirm(
        "Отправить приглашение повторно? Предыдущая отметка сохранится с новой датой.",
      )
    ) {
      return;
    }
    setBusy(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", id: ex.id, force }),
      });
      const data = (await res.json()) as {
        error?: string;
        to?: string;
      };
      if (!res.ok) {
        setInviteMsg(data.error || "Не удалось отправить");
        return;
      }
      setInviteMsg(`Отправлено на ${data.to ?? "email"}`);
      await refresh();
    } catch {
      setInviteMsg("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function checkBannerNow() {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch("/api/admin/banner-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", exchangerId: id }),
      });
      const body = (await res.json()) as {
        error?: string;
        ok?: number;
        missing?: number;
        errors?: number;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка проверки");
      setBannerMsg(
        body.ok
          ? "Баннер найден на сайте"
          : body.missing
            ? "Баннер не найден"
            : "Ошибка загрузки сайта",
      );
      await refresh();
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function bannerModeration(
    action: "warn" | "unpublish",
    notifyOwner = true,
  ) {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch("/api/admin/banner-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, exchangerId: id, notifyOwner }),
      });
      const body = (await res.json()) as {
        error?: string;
        results?: Array<{
          ok: boolean;
          error?: string;
          mailed?: boolean;
          warning?: string;
        }>;
      };
      if (!res.ok) throw new Error(body.error ?? "Ошибка");
      const first = body.results?.[0];
      if (first && !first.ok) throw new Error(first.error ?? "Ошибка");
      setBannerMsg(
        action === "warn"
          ? first?.mailed
            ? "Предупреждение отправлено владельцу"
            : "Готово"
          : first?.warning
            ? `Снято с публикации. ${first.warning}`
            : "Снято с публикации",
      );
      await refresh();
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mailWarning?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "fail");
      await refresh();
      if (data.mailWarning) {
        window.alert(data.mailWarning);
      } else if (body.status === "active") {
        window.alert(
          "Обменник одобрен. Письмо с доступом и 2FA отправлено на email владельца.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    const name = form.name.trim();
    const website = form.website.trim();
    const exchangeUrlTemplate = form.exchangeUrlTemplate.trim();
    const feedUrl = form.feedUrl.trim();
    const contact = form.contact.trim();
    const description = form.description.trim();

    if (name.length < 2) {
      setEditError("Укажите название");
      return;
    }
    if (!website || !feedUrl) {
      setEditError("Укажите сайт и URL фида");
      return;
    }

    setBusy(true);
    setEditError(null);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          website,
          exchangeUrlTemplate,
          feedUrl,
          contact,
          description,
          sync: syncAfterSave,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(body.error ?? "Не удалось сохранить");
        return;
      }

      if (logoFile) {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("logo", logoFile);
        const logoRes = await fetch("/api/admin/exchangers/logo", {
          method: "POST",
          body: fd,
        });
        const logoBody = (await logoRes.json()) as { error?: string };
        if (!logoRes.ok) {
          setEditError(logoBody.error ?? "Поля сохранены, но логотип не принят");
          await refresh();
          return;
        }
      }

      setLogoFile(null);
      await refresh();
    } catch {
      setEditError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function saveOwnerCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setOwnerError(null);
    setOwnerOk(false);
    try {
      const res = await fetch("/api/admin/exchangers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ownerLogin,
          ownerPassword,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setOwnerError(body.error ?? "Не удалось сохранить доступ");
        return;
      }
      setOwnerPassword("");
      setOwnerOk(true);
      await refresh();
    } catch {
      setOwnerError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    if (!confirm("Удалить логотип обменника?")) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("remove", "1");
      const res = await fetch("/api/admin/exchangers/logo", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("fail");
      await refresh();
      setLogoFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAchievement(achId: string, on: boolean) {
    if (!ex) return;
    const current = ex.achievementIds ?? [];
    const next = on
      ? [...new Set([...current, achId])]
      : current.filter((aid) => aid !== achId);
    await patch({ achievementIds: next });
  }

  async function remove() {
    if (!confirm("Удалить обменник, курсы и связанные отзывы?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/exchangers?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("fail");
      await refresh();
      router.push(`${ADMIN_PATH}/exchangers`);
    } finally {
      setBusy(false);
    }
  }

  if (!overview) {
    return <p className="text-sm text-ink-muted">Загрузка…</p>;
  }

  if (!ex || !form) {
    return (
      <div className="space-y-4">
        <Link
          href={`${ADMIN_PATH}/exchangers`}
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← К списку обменников
        </Link>
        <p className="text-sm text-danger">Обменник не найден</p>
      </div>
    );
  }

  const logoSrc = logoPublicUrl(ex.id, ex.logo);
  const traffic = ex.traffic ?? {
    pageViews: 0,
    siteClicks: 0,
    lastViewAt: null,
    lastClickAt: null,
    daily: [],
  };
  const daily = [...(traffic.daily ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`${ADMIN_PATH}/exchangers`}
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← К списку обменников
        </Link>
      </div>

      <AdminPageHeader
        title={ex.name}
        description={`Карточка обменника · ${ex.slug}`}
      />

      <AdminTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Обзор" },
          { id: "edit", label: "Редактирование" },
          { id: "banner", label: "Баннер" },
          { id: "cabinet", label: "Кабинет" },
          { id: "achievements", label: "Ачивки" },
          { id: "traffic", label: "Трафик" },
          {
            id: "reviews",
            label: "Отзывы",
            badge: reviews.filter((r) => r.status === "pending").length,
          },
        ]}
      />

      {tab === "banner" ? (
      <AdminSection
        title="Баннер GapSnap"
        description="Маленькая кнопка 88×31 на сайте обменника. Проверка раз в сутки."
      >
        <div className="space-y-3 p-5">
          <p className="text-sm text-ink">
            Статус:{" "}
            <strong>
              {bannerStatusLabel(ex.bannerCheck?.status ?? "pending")}
            </strong>
            {ex.bannerCheck?.lastCheckAt
              ? ` · проверка ${new Date(ex.bannerCheck.lastCheckAt).toLocaleString("ru-RU")}`
              : ""}
          </p>
          {ex.bannerCheck?.lastError ? (
            <p className="text-sm text-danger">{ex.bannerCheck.lastError}</p>
          ) : null}
          {ex.bannerToken ? (
            <>
              <p className="text-xs text-ink-muted">
                Токен: <code>{ex.bannerToken}</code>
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/badge/${ex.bannerToken}`}
                alt="GapSnap badge"
                width={88}
                height={31}
              />
              <pre className="overflow-x-auto rounded-2xl border border-line bg-bg-soft p-3 text-[11px] text-ink">
                {bannerEmbedHtml({
                  siteUrl:
                    typeof window !== "undefined"
                      ? window.location.origin
                      : "https://gapsnap.org",
                  token: ex.bannerToken,
                  slug: ex.slug,
                })}
              </pre>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              Токен появится после одобрения обменника.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (ex.status !== "active" && ex.status !== "error")}
              onClick={() => void checkBannerNow()}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted disabled:opacity-60"
            >
              Проверить сайт
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void bannerModeration("warn")}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink disabled:opacity-60"
            >
              Предупредить владельца
            </button>
            <button
              type="button"
              disabled={busy || (ex.status !== "active" && ex.status !== "error")}
              onClick={() => {
                if (
                  !confirm(
                    "Снять обменник с публикации и отправить письмо владельцу?",
                  )
                ) {
                  return;
                }
                void bannerModeration("unpublish", true);
              }}
              className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-60"
            >
              Снять + письмо
            </button>
            <Link
              href={`${ADMIN_PATH}/banners`}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-accent"
            >
              К списку баннеров →
            </Link>
          </div>
          {ex.bannerCheck?.lastOwnerWarnedAt ? (
            <p className="text-xs text-ink-muted">
              Последнее предупреждение владельцу:{" "}
              {new Date(ex.bannerCheck.lastOwnerWarnedAt).toLocaleString("ru-RU")}
              {ex.bannerCheck.ownerWarnCount
                ? ` (${ex.bannerCheck.ownerWarnCount}×)`
                : ""}
            </p>
          ) : null}
          {bannerMsg ? (
            <p className="text-sm text-ink-muted">{bannerMsg}</p>
          ) : null}
        </div>
      </AdminSection>
      ) : null}

      {tab === "overview" ? (
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="size-16 rounded-2xl bg-bg-soft object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/20 text-xl font-bold text-accent">
                {ex.name.slice(0, 1)}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={ex.status} />
                {ex.verified ? <StatusPill status="verified" /> : null}
                {ex.logo ? <StatusPill status="logo" /> : null}
              </div>
              <p className="mt-2 text-sm text-ink-muted">{ex.description || "—"}</p>
              <p className="mt-2 break-all text-xs text-ink-muted">
                Фид: {ex.feedUrl}
              </p>
              {ex.lastError ? (
                <p className="mt-1 text-xs text-danger">{ex.lastError}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ex.status !== "active" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void patch({ status: "active", sync: true })}
                className="rounded-xl bg-ok/20 px-3 py-2 text-xs font-semibold text-ok"
              >
                Одобрить
              </button>
            )}
            {ex.status !== "rejected" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void patch({ status: "rejected" })}
                className="rounded-xl bg-warn/20 px-3 py-2 text-xs font-semibold text-warn"
              >
                Отклонить
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ verified: !ex.verified })}
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
            >
              {ex.verified ? "Снять проверку" : "Отметить проверенным"}
            </button>
            <Link
              href={`/exchangers/${ex.slug}`}
              target="_blank"
              className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted"
            >
              Публичная страница
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
            >
              Удалить
            </button>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: "Рейтинг",
              value:
                ex.reviews === 0
                  ? "нет отзывов"
                  : `★ ${ex.rating.toFixed(2).replace(".", ",")}`,
              hint: ex.reviews
                ? `${ex.reviewsPositive}+ / ${ex.reviewsNegative}−`
                : undefined,
            },
            {
              label: "Пары",
              value: String(ex.pairCount),
            },
            {
              label: "В работе",
              value: ex.approvedAt
                ? `с ${new Date(ex.approvedAt).toLocaleDateString("ru-RU", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}`
                : "ещё не одобрен",
              hint: ex.approvedAt
                ? new Date(ex.approvedAt).toLocaleString("ru-RU")
                : "ставится при одобрении",
            },
            {
              label: "Просмотры",
              value: String(traffic.pageViews),
              hint: traffic.lastViewAt
                ? new Date(traffic.lastViewAt).toLocaleString("ru-RU")
                : undefined,
            },
            {
              label: "Переходы / конверсия",
              value: `${traffic.siteClicks} · ${formatOutboundCtr(traffic)}`,
              hint: traffic.lastClickAt
                ? new Date(traffic.lastClickAt).toLocaleString("ru-RU")
                : undefined,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-line bg-bg-soft/60 p-3"
            >
              <dt className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-ink">
                {item.value}
              </dd>
              {item.hint ? (
                <p className="mt-1 text-xs text-ink-muted">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </dl>

        <div className="mt-6 rounded-2xl border border-line bg-bg-soft/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Приглашение
              </p>
              {ex.inviteEmailSentAt ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-ok">
                    Отправлено{" "}
                    {new Date(ex.inviteEmailSentAt).toLocaleString("ru-RU")}
                  </p>
                  {ex.inviteEmailTo ? (
                    <p className="mt-1 break-all text-xs text-ink-muted">
                      → {ex.inviteEmailTo}
                    </p>
                  ) : null}
                </>
              ) : /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(ex.contact) ||
                (ex.ownerEmail && /@/.test(ex.ownerEmail)) ? (
                <p className="mt-1 text-sm font-semibold text-warn">
                  Ещё не отправлялось
                </p>
              ) : (
                <p className="mt-1 text-sm font-semibold text-ink-muted">
                  Нет email в contact / ownerEmail
                </p>
              )}
              {inviteMsg ? (
                <p className="mt-2 text-xs text-ink-muted">{inviteMsg}</p>
              ) : null}
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                {ex.inviteEmailSentAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendInvite(true)}
                    className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-muted disabled:opacity-60"
                  >
                    Отправить повторно
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !(
                        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(
                          ex.contact,
                        ) ||
                        (ex.ownerEmail && /@/.test(ex.ownerEmail))
                      )
                    }
                    onClick={() => void sendInvite(false)}
                    className="rounded-xl bg-accent/20 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-60"
                  >
                    Отправить приглашение
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}

      {tab === "edit" ? (
      <AdminSection title="Редактирование">
        <form onSubmit={(ev) => void saveEdit(ev)} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Название</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Контакт</span>
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Сайт</span>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                required
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-ink-muted">
                Шаблон ссылки на обмен ({"{0}"} = отдаёте, {"{1}"} = получаете)
              </span>
              <input
                value={form.exchangeUrlTemplate}
                onChange={(e) =>
                  setForm({ ...form, exchangeUrlTemplate: e.target.value })
                }
                placeholder="https://kubex.me/ru/exchange/{0}/{1}"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <span className="block text-[11px] text-ink-muted">
                Пусто — кнопка «Обменять» ведёт на сайт. С шаблоном откроется
                выбранная на мониторинге пара.
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Рейтинг (авто)</span>
              <p className="rounded-2xl border border-line bg-input px-3 py-2.5 text-sm text-ink-muted">
                {ex.reviews === 0
                  ? "Пока нет одобренных отзывов"
                  : `★ ${ex.rating.toFixed(2).replace(".", ",")} · ${ex.reviewsPositive} пол. / ${ex.reviewsNegative} отр.`}
              </p>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">XML-фид</span>
            <input
              value={form.feedUrl}
              onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
              required
              className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">Описание</span>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <div className="space-y-2">
            <span className="text-xs text-ink-muted">
              Логотип (SVG / PNG с прозрачностью)
            </span>
            <input
              type="file"
              accept=".svg,.png,image/svg+xml,image/png"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink file:mr-3 file:rounded-xl file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent"
            />
            <div className="flex flex-wrap gap-2">
              {ex.logo && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeLogo()}
                  className="rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger"
                >
                  Удалить текущий логотип
                </button>
              )}
              {logoFile && (
                <span className="text-xs text-ink-muted">
                  Новый файл: {logoFile.name}
                </span>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={syncAfterSave}
              onChange={(e) => setSyncAfterSave(e.target.checked)}
            />
            После сохранения синхронизировать фиды
          </label>
          {editError && <p className="text-sm text-danger">{editError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Сохранить
          </button>
        </form>
      </AdminSection>
      ) : null}

      {tab === "cabinet" ? (
      <AdminSection title="Кабинет владельца">
        <form
          onSubmit={(ev) => void saveOwnerCredentials(ev)}
          className="space-y-4 p-5"
        >
          <p className="text-sm text-ink-muted">
            Логин для{" "}
            <Link href="/cabinet" className="text-accent underline underline-offset-2">
              /cabinet
            </Link>
            . Владелец видит только статистику и может отвечать на отзывы.
            {ex.hasOwnerPassword
              ? " Пароль уже задан — укажите новый, чтобы сменить."
              : " Пароль ещё не задан."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Логин</span>
              <input
                value={ownerLogin}
                onChange={(e) => setOwnerLogin(e.target.value)}
                required
                pattern="[a-zA-Z0-9_]{3,32}"
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">Новый пароль</span>
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
          {ownerError && <p className="text-sm text-danger">{ownerError}</p>}
          {ownerOk && <p className="text-sm text-ok">Доступ сохранён</p>}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Сохранить доступ в кабинет
          </button>
        </form>
      </AdminSection>
      ) : null}

      {tab === "achievements" ? (
        <AdminSection title="Ачивки">
          {achievements.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Ачивок пока нет</p>
          ) : null}
          {achievements.length > 0 ? (
          <div className="space-y-4 p-5">
            {achievements.some((a) => (a.mode ?? "manual") === "manual") && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Ручные — нажмите, чтобы выдать
                </p>
                <div className="flex flex-wrap gap-2">
                  {achievements
                    .filter((a) => (a.mode ?? "manual") === "manual")
                    .map((ach) => {
                      const on = (ex.achievementIds ?? []).includes(ach.id);
                      return (
                        <button
                          key={ach.id}
                          type="button"
                          disabled={busy}
                          title={ach.description}
                          onClick={() => void toggleAchievement(ach.id, !on)}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                            on
                              ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                              : "border border-line text-ink-muted"
                          }`}
                        >
                          <span
                            className="inline-flex size-4 [&_svg]:h-full [&_svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: ach.svg }}
                          />
                          {ach.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {achievements.some((a) => a.mode === "auto") && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Авто — выдаёт система по правилам
                </p>
                <div className="flex flex-wrap gap-2">
                  {achievements
                    .filter((a) => a.mode === "auto")
                    .map((ach) => {
                      const on = (ex.achievementIds ?? []).includes(ach.id);
                      return (
                        <span
                          key={ach.id}
                          title={ach.description}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                            on
                              ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                              : "border border-dashed border-line text-ink-muted opacity-70"
                          }`}
                        >
                          <span
                            className="inline-flex size-4 [&_svg]:h-full [&_svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: ach.svg }}
                          />
                          {ach.name}
                          <span className="text-[10px] uppercase tracking-wide opacity-80">
                            авто
                          </span>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
          ) : null}
        </AdminSection>
      ) : null}

      {tab === "traffic" ? (
      <AdminSection
        title="Трафик страницы"
        description="Сводка по дням и подробный журнал с IP."
      >
        <div className="space-y-6 p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-bg-soft text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">День (UTC)</th>
                  <th className="px-3 py-2 font-medium">Просмотры</th>
                  <th className="px-3 py-2 font-medium">Переходы</th>
                  <th className="px-3 py-2 font-medium">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-ink-muted">
                      Пока нет данных — откройте публичную страницу обменника.
                    </td>
                  </tr>
                ) : (
                  daily.map((d) => (
                    <tr key={d.date} className="border-t border-line">
                      <td className="px-3 py-2 tabular-nums text-ink">{d.date}</td>
                      <td className="px-3 py-2 tabular-nums text-ink">
                        {d.pageViews}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink">
                        {d.siteClicks}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink">
                        {formatOutboundCtr(d)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">Журнал визитов</h3>
            <TrafficEventsPanel
              endpoint={`/api/admin/exchangers/traffic?exchangerId=${encodeURIComponent(id)}`}
            />
          </div>
        </div>
      </AdminSection>
      ) : null}

      {tab === "reviews" ? (
      <AdminSection title={`Отзывы (${reviews.length})`}>
        <div className="divide-y divide-line">
          {reviews.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Отзывов нет</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={r.status} />
                  <span className="text-xs text-ink-muted">
                    {r.sentiment === "positive" ? "положительный" : "отрицательный"}
                    {r.orderId ? ` · заказ ${r.orderId}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-ink">{r.text}</p>
              </div>
            ))
          )}
        </div>
      </AdminSection>
      ) : null}
    </div>
  );
}
