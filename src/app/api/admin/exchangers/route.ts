import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { deleteExchanger, listExchangers, updateExchanger } from "@/lib/store";
import { syncAllFeeds } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json({ exchangers: await listExchangers() });
}

export async function PATCH(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    status?: "pending" | "active" | "rejected" | "error";
    verified?: boolean;
    name?: string;
    website?: string;
    feedUrl?: string;
    contact?: string;
    description?: string;
    achievementIds?: string[];
    sync?: boolean;
    logo?: { format: "svg" | "png"; updatedAt: string } | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const patch: Parameters<typeof updateExchanger>[1] = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.verified !== undefined) patch.verified = body.verified;
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.website !== undefined) patch.website = body.website.trim();
  if (body.feedUrl !== undefined) patch.feedUrl = body.feedUrl.trim();
  if (body.contact !== undefined) patch.contact = body.contact.trim();
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.achievementIds !== undefined) {
    patch.achievementIds = body.achievementIds;
  }
  if (body.logo !== undefined) patch.logo = body.logo;

  const updated = await updateExchanger(body.id, patch);

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (body.sync || body.status === "active") {
    await syncAllFeeds();
  }

  return NextResponse.json({ exchanger: updated });
}

export async function DELETE(request: Request) {
  const denied = await assertAdmin();
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
