import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { validateExchangeUrlTemplate } from "@/lib/exchange-link";
import { hashOwnerPassword } from "@/lib/owner-auth";
import {
  extractEmail,
  sendOwnerApprovedEmail,
} from "@/lib/owner-mail";
import {
  createExchangerManual,
  deleteExchanger,
  ensureBannerToken,
  getExchangerById,
  getSeoSettings,
  listExchangers,
  provisionOwnerAccessOnApproval,
  setOwnerCredentials,
  updateExchanger,
} from "@/lib/store";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { syncAllFeeds, validateFeedUrl } from "@/lib/sync-feeds";
import {
  generateOwnerTempPassword,
  generateTotpSecret,
  totpAuthUri,
} from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newExchangerId(): string {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function toPublicExchanger(
  ex: Awaited<ReturnType<typeof createExchangerManual>>,
) {
  const { ownerPasswordHash: _h, ownerTotpSecret: _t, ...safe } = ex;
  return {
    ...safe,
    hasOwnerPassword: Boolean(_h),
    ownerTotpEnabled: Boolean(ex.ownerTotpEnabled),
  };
}

export async function GET() {
  const denied = await assertAdminResource("exchangers", "GET");
  if (denied) return denied;
  const list = await listExchangers();
  return NextResponse.json({
    exchangers: list.map(
      ({ ownerPasswordHash: _h, ownerTotpSecret: _t, ...ex }) => ({
        ...ex,
        hasOwnerPassword: Boolean(_h),
        ownerTotpEnabled: Boolean(ex.ownerTotpEnabled),
      }),
    ),
  });
}

/** Manual create from admin (no public apply / owner password required). */
export async function POST(request: Request) {
  const denied = await assertAdminResource("exchangers", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    website?: string;
    exchangeUrlTemplate?: string;
    feedUrl?: string;
    contact?: string;
    description?: string;
    ownerEmail?: string;
    ownerLogin?: string;
    status?: "pending" | "active";
    /** Skip live XML validation (useful when feed is temporarily down). */
    skipFeedCheck?: boolean;
    sync?: boolean;
  };

  const name = String(body.name ?? "").trim();
  const website = String(body.website ?? "").trim();
  const feedUrl = String(body.feedUrl ?? "").trim();
  const exchangeUrlTemplate = String(body.exchangeUrlTemplate ?? "").trim();
  const contact = String(body.contact ?? "").trim();
  const description = String(body.description ?? "").trim();
  const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
  const ownerLogin = String(body.ownerLogin ?? "").trim().toLowerCase();
  const status = body.status === "active" ? "active" : "pending";

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Укажите название обменника" },
      { status: 400 },
    );
  }
  try {
    await assertSafeOutboundUrl(website, { allowHttp: true });
  } catch {
    return NextResponse.json(
      { error: "Укажите корректный URL сайта" },
      { status: 400 },
    );
  }
  const templateError = validateExchangeUrlTemplate(exchangeUrlTemplate);
  if (templateError) {
    return NextResponse.json({ error: templateError }, { status: 400 });
  }
  if (exchangeUrlTemplate) {
    try {
      const sample = exchangeUrlTemplate
        .replaceAll("{0}", "BTC")
        .replaceAll("{1}", "USDTTRC20");
      await assertSafeOutboundUrl(sample, { allowHttp: true });
    } catch {
      return NextResponse.json(
        { error: "Некорректный шаблон ссылки на обмен" },
        { status: 400 },
      );
    }
  }
  try {
    await assertSafeOutboundUrl(feedUrl, { allowHttp: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректный URL XML-фида";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (ownerEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) || ownerEmail.length > 254) {
      return NextResponse.json(
        { error: "Некорректный email владельца" },
        { status: 400 },
      );
    }
  }
  if (ownerLogin && !/^[a-z0-9_]{3,32}$/.test(ownerLogin)) {
    return NextResponse.json(
      {
        error:
          "Логин кабинета: 3–32 символа, латиница, цифры и подчёркивание",
      },
      { status: 400 },
    );
  }

  let pairCount = 0;
  let feedWarning: string | null = null;
  if (!body.skipFeedCheck) {
    try {
      const validated = await validateFeedUrl(feedUrl);
      pairCount = validated.pairCount;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось проверить XML-фид";
      return NextResponse.json({ error: message }, { status: 422 });
    }
  } else {
    feedWarning =
      "Фид не проверялся при создании — запустите синхронизацию позже.";
  }

  try {
    let exchanger = await createExchangerManual({
      id: newExchangerId(),
      name,
      website,
      exchangeUrlTemplate,
      feedUrl,
      contact,
      description,
      pairCount,
      status,
      ownerEmail: ownerEmail || null,
      ownerLogin: ownerLogin || null,
    });

    if (status === "active") {
      try {
        const withToken = await ensureBannerToken(exchanger.id);
        if (withToken) exchanger = withToken;
      } catch (error) {
        console.error("[gapsnap] ensure banner token failed", error);
      }
    }

    if (body.sync || status === "active") {
      await syncAllFeeds();
      const refreshed = await getExchangerById(exchanger.id);
      if (refreshed) exchanger = refreshed;
    }

    return NextResponse.json({
      ok: true,
      exchanger: toPublicExchanger(exchanger),
      feedWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    if (message === "OWNER_LOGIN_TAKEN") {
      return NextResponse.json(
        { error: "Такой логин уже занят" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("exchangers", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    status?: "pending" | "active" | "rejected" | "error";
    verified?: boolean;
    name?: string;
    website?: string;
    exchangeUrlTemplate?: string;
    feedUrl?: string;
    contact?: string;
    description?: string;
    achievementIds?: string[];
    sync?: boolean;
    logo?: { format: "svg" | "png"; updatedAt: string } | null;
    ownerLogin?: string;
    ownerPassword?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (body.ownerLogin !== undefined || body.ownerPassword !== undefined) {
    const ownerLogin = String(body.ownerLogin ?? "").trim().toLowerCase();
    const ownerPassword = String(body.ownerPassword ?? "");
    if (!/^[a-z0-9_]{3,32}$/.test(ownerLogin)) {
      return NextResponse.json(
        {
          error:
            "Логин кабинета: 3–32 символа, латиница, цифры и подчёркивание",
        },
        { status: 400 },
      );
    }
    if (ownerPassword.length < 6) {
      return NextResponse.json(
        { error: "Пароль кабинета не короче 6 символов" },
        { status: 400 },
      );
    }
    try {
      const hash = await hashOwnerPassword(ownerPassword);
      const updated = await setOwnerCredentials(body.id, {
        ownerLogin,
        ownerPasswordHash: hash,
      });
      if (!updated) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      const {
        ownerPasswordHash: _h,
        ownerTotpSecret: _t,
        ...safe
      } = updated;
      return NextResponse.json({
        exchanger: {
          ...safe,
          hasOwnerPassword: true,
          ownerTotpEnabled: updated.ownerTotpEnabled,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "fail";
      if (message === "OWNER_LOGIN_TAKEN") {
        return NextResponse.json(
          { error: "Такой логин уже занят" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const before = await getExchangerById(body.id);
  if (!before) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const patch: Parameters<typeof updateExchanger>[1] = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.verified !== undefined) patch.verified = body.verified;
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.website !== undefined) patch.website = body.website.trim();
  if (body.exchangeUrlTemplate !== undefined) {
    const tpl = body.exchangeUrlTemplate.trim();
    const templateError = validateExchangeUrlTemplate(tpl);
    if (templateError) {
      return NextResponse.json({ error: templateError }, { status: 400 });
    }
    patch.exchangeUrlTemplate = tpl;
  }
  if (body.feedUrl !== undefined) patch.feedUrl = body.feedUrl.trim();
  if (body.contact !== undefined) patch.contact = body.contact.trim();
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.achievementIds !== undefined) {
    patch.achievementIds = body.achievementIds;
  }
  if (body.logo !== undefined) patch.logo = body.logo;

  let updated = await updateExchanger(body.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let mailWarning: string | null = null;
  const becomingActive =
    body.status === "active" && before.status !== "active";

  if (becomingActive) {
    try {
      const withToken = await ensureBannerToken(updated.id);
      if (withToken) updated = withToken;
    } catch (error) {
      console.error("[gapsnap] ensure banner token failed", error);
    }

    const to =
      updated.ownerEmail?.trim().toLowerCase() ||
      extractEmail(updated.contact);
    if (!to) {
      mailWarning =
        "Обменник одобрен, но email владельца не найден — письмо с доступом не отправлено.";
    } else if (!updated.ownerLogin) {
      mailWarning =
        "Обменник одобрен, но логин кабинета не задан — письмо не отправлено.";
    } else {
      try {
        const tempPassword = generateOwnerTempPassword();
        const totpSecret = generateTotpSecret();
        const passwordHash = await hashOwnerPassword(tempPassword);
        const provisioned = await provisionOwnerAccessOnApproval(updated.id, {
          ownerPasswordHash: passwordHash,
          totpSecret,
        });
        if (provisioned) updated = provisioned;

        const seo = await getSeoSettings();
        const issuer = seo.siteName || "GapSnap";
        await sendOwnerApprovedEmail({
          to,
          exchangerName: updated.name,
          ownerLogin: updated.ownerLogin!,
          tempPassword,
          totpSecret,
          totpUri: totpAuthUri(totpSecret, updated.ownerLogin!, issuer),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "ошибка отправки";
        mailWarning = `Обменник одобрен, но письмо не ушло: ${message}`;
      }
    }
  }

  if (body.sync || body.status === "active") {
    await syncAllFeeds();
  }

  const {
    ownerPasswordHash: _h,
    ownerTotpSecret: _t,
    ...safe
  } = updated;
  return NextResponse.json({
    exchanger: {
      ...safe,
      hasOwnerPassword: Boolean(_h),
      ownerTotpEnabled: updated.ownerTotpEnabled,
    },
    mailWarning,
  });
}

export async function DELETE(request: Request) {
  const denied = await assertAdminResource("exchangers", request.method);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteExchanger(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
