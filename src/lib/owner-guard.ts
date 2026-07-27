import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  isOwnerSessionExpired,
  ownerSessionToken,
  parseOwnerCookie,
  timingSafeEqualStr,
} from "@/lib/owner-auth";
import { getExchangerById } from "@/lib/store";
import type { FeedExchanger } from "@/lib/store-types";

export async function resolveOwnerSession(): Promise<FeedExchanger | null> {
  const jar = await cookies();
  const parsed = parseOwnerCookie(jar.get(OWNER_COOKIE)?.value);
  if (!parsed) return null;
  if (isOwnerSessionExpired(parsed.token)) return null;

  const ex = await getExchangerById(parsed.exchangerId);
  if (!ex?.ownerLogin || !ex.ownerPasswordHash) return null;

  const parts = parsed.token.split(".");
  const exp = parts[0] === "v2" ? Number(parts[1]) : undefined;
  const expectedToken = await ownerSessionToken({
    exchangerId: ex.id,
    ownerLogin: ex.ownerLogin,
    ownerPasswordHash: ex.ownerPasswordHash,
    exp: Number.isFinite(exp) ? exp : undefined,
  });

  if (!timingSafeEqualStr(parsed.token, expectedToken)) return null;
  return ex;
}

export async function assertOwner(): Promise<
  | { error: NextResponse; exchanger?: undefined }
  | { error?: undefined; exchanger: FeedExchanger }
> {
  const ex = await resolveOwnerSession();
  if (!ex) {
    return {
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { exchanger: ex };
}
