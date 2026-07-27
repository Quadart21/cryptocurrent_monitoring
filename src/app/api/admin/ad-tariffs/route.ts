import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  addAdTariff,
  getAdPricing,
  listAdTariffs,
  removeAdTariff,
  updateAdPricing,
  updateAdTariff,
} from "@/lib/store";
import type { AdPlacement, AdTariffPeriod, AdType } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  const [tariffs, pricing] = await Promise.all([
    listAdTariffs(),
    getAdPricing(),
  ]);
  return NextResponse.json({ tariffs, pricing });
}

export async function PATCH(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    kind?: "tariff" | "pricing";
    id?: string;
    contact?: string;
    intro?: string;
    note?: string;
    title?: string;
    description?: string;
    sizeLabel?: string;
    price?: number;
    period?: AdTariffPeriod;
    features?: string[];
    active?: boolean;
    sortOrder?: number;
    placement?: AdPlacement;
    type?: AdType;
  };

  if (body.kind === "pricing") {
    const pricing = await updateAdPricing({
      contact: body.contact,
      intro: body.intro,
      note: body.note,
    });
    return NextResponse.json({ pricing });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updated = await updateAdTariff(body.id, {
    title: body.title,
    description: body.description,
    sizeLabel: body.sizeLabel,
    price: body.price,
    period: body.period,
    features: body.features,
    active: body.active,
    sortOrder: body.sortOrder,
    placement: body.placement,
    type: body.type,
  });

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ tariff: updated });
}

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    placement?: AdPlacement;
    type?: AdType;
    title?: string;
    description?: string;
    sizeLabel?: string;
    price?: number;
    period?: AdTariffPeriod;
    features?: string[];
    sortOrder?: number;
  };

  if (!body.placement || !body.type || !body.title?.trim()) {
    return NextResponse.json(
      { error: "Укажите тип, слот и название" },
      { status: 400 },
    );
  }
  if (typeof body.price !== "number" || body.price < 0) {
    return NextResponse.json({ error: "Укажите цену" }, { status: 400 });
  }

  const tariff = await addAdTariff({
    placement: body.placement,
    type: body.type,
    title: body.title,
    description: body.description,
    sizeLabel: body.sizeLabel,
    price: body.price,
    period: body.period,
    features: body.features,
    sortOrder: body.sortOrder,
  });
  return NextResponse.json({ tariff });
}

export async function DELETE(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await removeAdTariff(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
