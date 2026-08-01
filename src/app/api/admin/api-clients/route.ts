import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import { sendTemplatedEmail, siteBaseUrl } from "@/lib/email/service";
import {
  approveApiClient,
  listApiClients,
  setApiClientStatus,
} from "@/lib/public-api/auth";
import { getSeoSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("api_clients", "GET");
  if (denied) return denied;
  const clients = await listApiClients();
  return NextResponse.json({
    clients: clients.map(({ keyHash: _h, ...c }) => c),
  });
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("api_clients", request.method);
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: string;
    action?: "approve" | "reject" | "revoke" | "pending";
    adminNote?: string;
  };

  if (!body.id || !body.action) {
    return NextResponse.json(
      { error: "id and action required" },
      { status: 400 },
    );
  }

  const note =
    body.adminNote !== undefined ? String(body.adminNote).slice(0, 2000) : undefined;

  if (body.action === "approve") {
    const result = await approveApiClient(body.id, note);
    if (!result) {
      return NextResponse.json(
        { error: "Не найдено или ключ уже выдан" },
        { status: 400 },
      );
    }

    const seo = await getSeoSettings();
    const base = siteBaseUrl(seo.siteUrl);
    await sendTemplatedEmail({
      templateId: "api_key_approved",
      to: result.client.email,
      tag: "api-key-approved",
      gate: "notifyApiKeyApproved",
      vars: {
        clientName: result.client.name,
        apiKey: result.plainKey,
        docsUrl: `${base}/api-docs`,
        exampleUrl: `${base}/v2/${result.plainKey}/langs`,
      },
    });

    const { keyHash: _h, ...safe } = result.client;
    return NextResponse.json({
      client: safe,
      message: "Ключ отправлен на email заявителя",
    });
  }

  if (
    body.action === "reject" ||
    body.action === "revoke" ||
    body.action === "pending"
  ) {
    const status =
      body.action === "pending"
        ? "pending"
        : body.action === "reject"
          ? "rejected"
          : "revoked";
    const updated = await setApiClientStatus(body.id, status, note);
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const { keyHash: _h, ...safe } = updated;
    return NextResponse.json({ client: safe });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
