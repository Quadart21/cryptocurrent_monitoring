import { NextResponse } from "next/server";
import { assertOwner } from "@/lib/owner-guard";
import { replyToReview } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await assertOwner();
  if (auth.error) return auth.error;

  if (auth.exchanger.status !== "active" && auth.exchanger.status !== "error") {
    return NextResponse.json(
      { error: "Отвечать на отзывы можно после одобрения заявки" },
      { status: 403 },
    );
  }

  let body: { id?: string; reply?: string };
  try {
    body = (await request.json()) as { id?: string; reply?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const review = await replyToReview(
      body.id,
      auth.exchanger.id,
      String(body.reply ?? ""),
    );
    if (!review) {
      return NextResponse.json(
        { error: "Отзыв не найден или ещё не одобрен" },
        { status: 404 },
      );
    }
    return NextResponse.json({ review });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить ответ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
