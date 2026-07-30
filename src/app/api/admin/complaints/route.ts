import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  deleteComplaint,
  listComplaints,
  updateComplaint,
} from "@/lib/complaints";
import type { ComplaintStatus } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await assertAdminResource("complaints", request.method);
  if (denied) return denied;
  const raw = new URL(request.url).searchParams.get("status");
  let options: { status?: ComplaintStatus | "open" } | undefined;
  if (!raw || raw === "open") {
    options = { status: "open" };
  } else if (raw === "all") {
    options = undefined;
  } else {
    options = { status: raw as ComplaintStatus };
  }
  const complaints = await listComplaints(options);
  return NextResponse.json({ complaints });
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("complaints", request.method);
  if (denied) return denied;
  const body = (await request.json()) as {
    id?: string;
    status?: ComplaintStatus;
    adminNote?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const complaint = await updateComplaint(body.id, {
    status: body.status,
    adminNote: body.adminNote,
  });
  if (!complaint) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ complaint });
}

export async function DELETE(request: Request) {
  const denied = await assertAdminResource("complaints", request.method);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await deleteComplaint(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
