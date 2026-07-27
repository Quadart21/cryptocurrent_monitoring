import { NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  encodeOwnerCookie,
  hashOwnerPassword,
  ownerSessionToken,
  timingSafeEqualStr,
} from "@/lib/owner-auth";
import { findExchangerByOwnerLogin } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { login?: string; password?: string };
  try {
    body = (await request.json()) as { login?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const login = String(body.login ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (login.length < 2 || password.length < 4) {
    return NextResponse.json(
      { error: "Укажите логин и пароль" },
      { status: 400 },
    );
  }

  const ex = await findExchangerByOwnerLogin(login);
  if (!ex?.ownerLogin || !ex.ownerPasswordHash) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  const hash = await hashOwnerPassword(password);
  if (!timingSafeEqualStr(hash, ex.ownerPasswordHash)) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  const token = await ownerSessionToken({
    exchangerId: ex.id,
    ownerLogin: ex.ownerLogin,
    ownerPasswordHash: ex.ownerPasswordHash,
  });

  const res = NextResponse.json({
    ok: true,
    exchanger: {
      id: ex.id,
      slug: ex.slug,
      name: ex.name,
      status: ex.status,
    },
  });

  res.cookies.set(OWNER_COOKIE, encodeOwnerCookie(ex.id, token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
