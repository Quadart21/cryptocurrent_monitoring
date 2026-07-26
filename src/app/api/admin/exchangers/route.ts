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
    rating?: number;
    reviews?: number;
    sync?: boolean;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updated = await updateExchanger(body.id, {
    status: body.status,
    verified: body.verified,
    name: body.name,
    website: body.website,
    feedUrl: body.feedUrl,
    contact: body.contact,
    description: body.description,
    rating: body.rating,
    reviews: body.reviews,
  });

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
