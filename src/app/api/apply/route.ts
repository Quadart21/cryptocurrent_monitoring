import { NextResponse } from "next/server";
import { hashOwnerPassword } from "@/lib/owner-auth";
import { addExchangerApplication } from "@/lib/store";
import {
  saveExchangerLogo,
  validateAndPrepareLogo,
} from "@/lib/logo";
import { validateFeedUrl } from "@/lib/sync-feeds";

export const runtime = "nodejs";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function newExchangerId(): string {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: Request) {
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
  const description = String(form.get("description") ?? "").trim();
  const ownerLogin = String(form.get("ownerLogin") ?? "").trim().toLowerCase();
  const ownerPassword = String(form.get("ownerPassword") ?? "");
  const ownerPasswordConfirm = String(form.get("ownerPasswordConfirm") ?? "");
  const logoField = form.get("logo");
  const logoFile = logoField instanceof File ? logoField : null;

  if (name.length < 2) {
    return NextResponse.json({ error: "Укажите название обменника" }, { status: 400 });
  }
  if (!isHttpUrl(website)) {
    return NextResponse.json({ error: "Укажите корректный URL сайта" }, { status: 400 });
  }
  if (!isHttpUrl(feedUrl)) {
    return NextResponse.json(
      { error: "Укажите корректный URL XML-фида (valuta.xml)" },
      { status: 400 },
    );
  }
  if (contact.length < 3) {
    return NextResponse.json(
      { error: "Укажите контакт (email или Telegram)" },
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
  if (ownerPassword.length < 6) {
    return NextResponse.json(
      { error: "Пароль кабинета не короче 6 символов" },
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

    let logoMeta: { format: "svg" | "png"; updatedAt: string } | null = null;
    if (preparedLogo) {
      logoMeta = await saveExchangerLogo(id, preparedLogo);
    }

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
      ownerLogin,
      ownerPasswordHash,
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
      message: `Заявка принята (на модерации). В фиде найдено направлений: ${pairCount}. После одобрения войдите в кабинет владельца (/cabinet) логином «${ownerLogin}», чтобы смотреть статистику и отвечать на отзывы.`,
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
