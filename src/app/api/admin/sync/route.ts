import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  countPendingCatalogProposals,
  listCatalogProposals,
  moderateCatalogProposal,
} from "@/lib/bestchange/catalog-proposals";
import { getCatalogSnapshot } from "@/lib/bestchange/catalog-store";
import { runCatalogDiscovery } from "@/lib/bestchange/sync-catalogs";
import { syncAllFeeds } from "@/lib/sync-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdminResource("sync", request.method);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "summary";
  const snap = getCatalogSnapshot();
  const pendingCatalog = await countPendingCatalogProposals();

  if (view === "proposals") {
    const status = (searchParams.get("status") ?? "pending") as
      | "pending"
      | "approved"
      | "rejected"
      | "all";
    const proposals = await listCatalogProposals(status);
    return NextResponse.json({
      proposals,
      pendingCatalog,
      catalog: {
        fetchedAt: snap.fetchedAt,
        counts: snap.counts,
        source: snap.source,
      },
    });
  }

  return NextResponse.json({
    pendingCatalog,
    catalog: {
      fetchedAt: snap.fetchedAt,
      counts: snap.counts,
      source: snap.source,
    },
  });
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("sync", request.method);
  if (denied) return denied;

  let action = "feeds";
  let proposalId = "";
  let proposalStatus: "approved" | "rejected" = "approved";
  try {
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      status?: "approved" | "rejected";
    };
    if (
      body?.action === "catalogs" ||
      body?.action === "feeds" ||
      body?.action === "proposal"
    ) {
      action = body.action;
    }
    if (body?.id) proposalId = body.id;
    if (body?.status === "approved" || body?.status === "rejected") {
      proposalStatus = body.status;
    }
  } catch {
    // empty body → feeds
  }

  try {
    if (action === "catalogs") {
      const result = await runCatalogDiscovery();
      return NextResponse.json({ action: "catalogs", ...result });
    }
    if (action === "proposal") {
      if (!proposalId) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      const proposal = await moderateCatalogProposal(proposalId, proposalStatus);
      if (!proposal) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json({ proposal });
    }
    const result = await syncAllFeeds();
    return NextResponse.json({ action: "feeds", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
