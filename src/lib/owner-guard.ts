import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  OWNER_COOKIE,
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

  const ex = await getExchangerById(parsed.exchangerId);
  if (!ex?.ownerLogin || !ex.ownerPasswordHash) return null;

  const expected = await ownerSessionToken({
    exchangerId: ex.id,
    ownerLogin: ex.ownerLogin,
    ownerPasswordHash: ex.ownerPasswordHash,
  });
  if (!timingSafeEqualStr(parsed.token, expected)) return null;
  return ex;
}

/** null = ok, иначе 401 response */
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
