import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { hashOwnerPassword } from "@/lib/owner-auth";
import {
  deleteExchanger,
  listExchangers,
  setOwnerCredentials,
  updateExchanger,
} from "@/lib/store";
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
      const { ownerPasswordHash: _h, ...safe } = updated;
      return NextResponse.json({
        exchanger: { ...safe, hasOwnerPassword: true },
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

  const { ownerPasswordHash: _h, ...safe } = updated;
  return NextResponse.json({
    exchanger: { ...safe, hasOwnerPassword: Boolean(_h) },
  });
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
