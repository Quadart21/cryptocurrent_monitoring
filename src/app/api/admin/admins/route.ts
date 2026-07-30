import { NextResponse } from "next/server";
import {
  isSessionContext,
  requireAdminSession,
} from "@/lib/admin-guard";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resetAdminTotp,
  updateAdminUser,
} from "@/lib/admin-users";
import { isAdminRole } from "@/lib/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdminSession("admins.read");
  if (!isSessionContext(session)) return session;
  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await requireAdminSession("admins.write");
  if (!isSessionContext(session)) return session;

  const body = (await request.json()) as {
    action?: string;
    id?: string;
    login?: string;
    password?: string;
    role?: string;
    displayName?: string;
    active?: boolean;
  };

  if (body.action === "reset_totp") {
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const result = await resetAdminTotp(body.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  if (!body.login || !body.password || !body.role || !isAdminRole(body.role)) {
    return NextResponse.json(
      { error: "Нужны login, password и role" },
      { status: 400 },
    );
  }

  const result = await createAdminUser({
    login: body.login,
    password: body.password,
    role: body.role,
    displayName: body.displayName,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const session = await requireAdminSession("admins.write");
  if (!isSessionContext(session)) return session;

  const body = (await request.json()) as {
    id?: string;
    role?: string;
    active?: boolean;
    displayName?: string;
    password?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (body.role && !isAdminRole(body.role)) {
    return NextResponse.json({ error: "Неизвестная роль" }, { status: 400 });
  }

  const result = await updateAdminUser(
    body.id,
    {
      role: body.role && isAdminRole(body.role) ? body.role : undefined,
      active: body.active,
      displayName: body.displayName,
      password: body.password,
    },
    session.user.id,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ user: result });
}

export async function DELETE(request: Request) {
  const session = await requireAdminSession("admins.write");
  if (!isSessionContext(session)) return session;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const result = await deleteAdminUser(id, session.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
