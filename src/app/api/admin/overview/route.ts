import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { getStore, listBlacklist, listExchangers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const [store, exchangers, blacklist] = await Promise.all([
    getStore(),
    listExchangers(),
    listBlacklist(),
  ]);

  return NextResponse.json({
    lastGlobalSyncAt: store.lastGlobalSyncAt,
    counts: {
      exchangers: exchangers.length,
      active: exchangers.filter((e) => e.status === "active").length,
      pending: exchangers.filter((e) => e.status === "pending").length,
      error: exchangers.filter((e) => e.status === "error").length,
      rates: store.rates.length,
      blacklist: blacklist.length,
    },
    exchangers,
    blacklist,
  });
}
