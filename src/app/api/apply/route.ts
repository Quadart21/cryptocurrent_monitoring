import { NextResponse } from "next/server";
import { addExchangerApplication } from "@/lib/store";
import { validateFeedUrl } from "@/lib/sync-feeds";

export const runtime = "nodejs";

type Body = {
  name?: string;
  website?: string;
  feedUrl?: string;
  contact?: string;
  description?: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const website = body.website?.trim() ?? "";
  const feedUrl = body.feedUrl?.trim() ?? "";
  const contact = body.contact?.trim() ?? "";
  const description = body.description?.trim() ?? "";

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

  try {
    const { pairCount } = await validateFeedUrl(feedUrl);

    const exchanger = await addExchangerApplication({
      name,
      website,
      feedUrl,
      contact,
      description:
        description ||
        `Заявка на добавление. Курсы подтягиваются из XML-фида раз в минуту.`,
      pairCount,
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
      message: `Заявка принята (на модерации). В фиде найдено направлений: ${pairCount}. После одобрения курсы появятся в мониторинге.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось проверить XML-фид";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
