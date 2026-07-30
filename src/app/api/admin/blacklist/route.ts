import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  addBlacklistItem,
  listBlacklist,
  removeBlacklistItem,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdminResource("blacklist", request.method);
  if (denied) return denied;
  return NextResponse.json({ blacklist: await listBlacklist() });
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("blacklist", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    reason?: string;
    reports?: number;
    exchangerId?: string | null;
  };

  if (!body.name?.trim() || !body.reason?.trim()) {
    return NextResponse.json(
      { error: "Укажите название и причину" },
      { status: 400 },
    );
  }

  try {
    const item = await addBlacklistItem({
      name: body.name.trim(),
      reason: body.reason.trim(),
      reports: body.reports,
      exchangerId: body.exchangerId ?? null,
    });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    if (message === "ALREADY_BLACKLISTED") {
      return NextResponse.json(
        { error: "Этот обменник уже в чёрном списке" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const denied = await assertAdminResource("blacklist", request.method);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await removeBlacklistItem(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
