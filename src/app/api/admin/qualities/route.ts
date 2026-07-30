import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  addQualityTag,
  listQualityTags,
  removeQualityTag,
  updateQualityTag,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("qualities", "GET");
  if (denied) return denied;
  return NextResponse.json({ tags: await listQualityTags() });
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("qualities", request.method);
  if (denied) return denied;

  const body = (await request.json()) as { label?: string };
  const label = body.label?.trim() ?? "";
  if (label.length < 2) {
    return NextResponse.json(
      { error: "Укажите название качества (мин. 2 символа)" },
      { status: 400 },
    );
  }

  const tag = await addQualityTag(label);
  return NextResponse.json({ tag });
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("qualities", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    label?: string;
    active?: boolean;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const patch: { label?: string; active?: boolean } = {};
  if (typeof body.label === "string" && body.label.trim()) {
    patch.label = body.label.trim();
  }
  if (typeof body.active === "boolean") {
    patch.active = body.active;
  }

  const tag = await updateQualityTag(body.id, patch);
  if (!tag) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ tag });
}

export async function DELETE(request: Request) {
  const denied = await assertAdminResource("qualities", request.method);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await removeQualityTag(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
