import { NextResponse } from "next/server";
import { hashOwnerPassword } from "@/lib/owner-auth";
import { addExchangerApplication } from "@/lib/store";
import { validateAndPrepareLogo } from "@/lib/logo";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { rateLimitedResponse } from "@/lib/security/request";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";
import { validateFeedUrl } from "@/lib/sync-feeds";

export const runtime = "nodejs";

function newExchangerId(): string {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: Request) {
  const limited = rateLimit(`apply:${clientIp(request)}`, 5, 15 * 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfterSec);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Некорректная форма" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const website = String(form.get("website") ?? "").trim();
  const feedUrl = String(form.get("feedUrl") ?? "").trim();
  const contact = String(form.get("contact") ?? "").trim();
  const ownerEmail = String(form.get("ownerEmail") ?? "").trim().toLowerCase();
  const description = String(form.get("description") ?? "").trim();
  const ownerLogin = String(form.get("ownerLogin") ?? "").trim().toLowerCase();
  const ownerPassword = String(form.get("ownerPassword") ?? "");
  const ownerPasswordConfirm = String(form.get("ownerPasswordConfirm") ?? "");
  const logoField = form.get("logo");
  const logoFile = logoField instanceof File ? logoField : null;

  if (name.length < 2) {
    return NextResponse.json({ error: "Укажите название обменника" }, { status: 400 });
  }
  try {
    await assertSafeOutboundUrl(website, { allowHttp: true });
  } catch {
    return NextResponse.json({ error: "Укажите корректный URL сайта" }, { status: 400 });
  }
  try {
    await assertSafeOutboundUrl(feedUrl, { allowHttp: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректный URL XML-фида";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (contact.length < 3) {
    return NextResponse.json(
      { error: "Укажите контакт (email или Telegram)" },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) || ownerEmail.length > 254) {
    return NextResponse.json(
      { error: "Укажите корректный email владельца — на него придут доступ и 2FA" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9_]{3,32}$/.test(ownerLogin)) {
    return NextResponse.json(
      {
        error:
          "Логин кабинета: 3–32 символа, только латиница, цифры и подчёркивание",
      },
      { status: 400 },
    );
  }
  if (ownerPassword.length < 8) {
    return NextResponse.json(
      { error: "Пароль кабинета не короче 8 символов" },
      { status: 400 },
    );
  }
  if (ownerPassword !== ownerPasswordConfirm) {
    return NextResponse.json(
      { error: "Пароли не совпадают" },
      { status: 400 },
    );
  }

  let preparedLogo: Awaited<ReturnType<typeof validateAndPrepareLogo>> = null;
  try {
    preparedLogo = await validateAndPrepareLogo(logoFile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректный логотип";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { pairCount } = await validateFeedUrl(feedUrl);
    const id = newExchangerId();
    const ownerPasswordHash = await hashOwnerPassword(ownerPassword);

    const logoMeta = preparedLogo
      ? {
          format: preparedLogo.format,
          updatedAt: new Date().toISOString(),
        }
      : null;

    const exchanger = await addExchangerApplication({
      id,
      name,
      website,
      feedUrl,
      contact,
      description:
        description ||
        `Заявка на добавление. Курсы подтягиваются из XML-фида раз в минуту.`,
      pairCount,
      logo: logoMeta,
      logoData: preparedLogo?.bytes ?? null,
      ownerLogin,
      ownerPasswordHash,
      ownerEmail,
    });

    return NextResponse.json({
      ok: true,
      exchanger: {
        id: exchanger.id,
        slug: exchanger.slug,
        name: exchanger.name,
        status: exchanger.status,
        pairCount,
      },
      message: `Заявка принята (на модерации). После одобрения на ${ownerEmail} придут логин, временный пароль и данные 2FA для кабинета /cabinet.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось проверить XML-фид";
    if (message === "OWNER_LOGIN_TAKEN") {
      return NextResponse.json(
        { error: "Такой логин кабинета уже занят" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
