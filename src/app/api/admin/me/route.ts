import { NextResponse } from "next/server";
import {
  isSessionContext,
  requireAdminSession,
} from "@/lib/admin-guard";
import {
  adminMePayload,
  changeOwnPassword,
  confirmSelfTotp,
  enableSelfTotp,
} from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdminSession();
  if (!isSessionContext(session)) return session;
  return NextResponse.json({ me: adminMePayload(session.user) });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!isSessionContext(session)) return session;

  const body = (await request.json()) as {
    action?: "start" | "confirm" | "change_password";
    code?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  if (body.action === "change_password") {
    const result = await changeOwnPassword(session.user.id, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword ?? "",
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "confirm") {
    const result = await confirmSelfTotp(session.user.id, body.code ?? "");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const result = await enableSelfTotp(session.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
