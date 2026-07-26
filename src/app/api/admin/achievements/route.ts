import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { sanitizeAchievementSvg } from "@/lib/sanitize-svg";
import {
  addAchievement,
  listAchievements,
  removeAchievement,
  updateAchievement,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json({ achievements: await listAchievements() });
}

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    svg?: string;
  };

  const name = body.name?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const svg = sanitizeAchievementSvg(body.svg ?? "");

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Укажите название ачивки (мин. 2 символа)" },
      { status: 400 },
    );
  }
  if (description.length < 3) {
    return NextResponse.json(
      { error: "Укажите описание для подсказки при наведении" },
      { status: 400 },
    );
  }
  if (!svg) {
    return NextResponse.json(
      { error: "Вставьте корректный SVG-код иконки" },
      { status: 400 },
    );
  }

  const achievement = await addAchievement({ name, description, svg });
  return NextResponse.json({ achievement });
}

export async function PATCH(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string;
    svg?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const patch: { name?: string; description?: string; svg?: string } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.svg === "string") {
    const svg = sanitizeAchievementSvg(body.svg);
    if (!svg) {
      return NextResponse.json(
        { error: "Вставьте корректный SVG-код иконки" },
        { status: 400 },
      );
    }
    patch.svg = svg;
  }

  const achievement = await updateAchievement(body.id, patch);
  if (!achievement) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ achievement });
}

export async function DELETE(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await removeAchievement(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
