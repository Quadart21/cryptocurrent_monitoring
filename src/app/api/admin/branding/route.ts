import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  deleteSiteAsset,
  isSiteAssetKind,
  saveSiteAsset,
  SITE_ASSET_KINDS,
  validateAndPrepareSiteAsset,
} from "@/lib/branding";
import { listSiteAssetMeta } from "@/lib/store";
import { brandingPublicUrl } from "@/lib/branding-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdminResource("branding", "GET");
  if (denied) return denied;

  const assets = await listSiteAssetMeta();
  return NextResponse.json({
    assets: SITE_ASSET_KINDS.map((kind) => {
      const meta = assets.find((a) => a.kind === kind) ?? null;
      return {
        kind,
        meta,
        url: brandingPublicUrl(kind, meta),
      };
    }),
  });
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("branding", request.method);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Некорректная форма" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "").trim();
  if (!isSiteAssetKind(kindRaw)) {
    return NextResponse.json(
      { error: "Неизвестный тип ассета" },
      { status: 400 },
    );
  }

  const remove = String(form.get("remove") ?? "") === "1";
  if (remove) {
    await deleteSiteAsset(kindRaw);
    const assets = await listSiteAssetMeta();
    return NextResponse.json({
      ok: true,
      assets: SITE_ASSET_KINDS.map((kind) => {
        const meta = assets.find((a) => a.kind === kind) ?? null;
        return {
          kind,
          meta,
          url: brandingPublicUrl(kind, meta),
        };
      }),
    });
  }

  const fileField = form.get("file");
  const file = fileField instanceof File ? fileField : null;

  let prepared;
  try {
    prepared = await validateAndPrepareSiteAsset(kindRaw, file);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректный файл";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const meta = await saveSiteAsset(kindRaw, prepared);
  const assets = await listSiteAssetMeta();
  return NextResponse.json({
    ok: true,
    meta,
    url: brandingPublicUrl(kindRaw, meta),
    assets: SITE_ASSET_KINDS.map((kind) => {
      const m = assets.find((a) => a.kind === kind) ?? null;
      return {
        kind,
        meta: m,
        url: brandingPublicUrl(kind, m),
      };
    }),
  });
}
