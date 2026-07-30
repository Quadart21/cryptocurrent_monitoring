import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  AD_TYPE_PLACEMENTS,
  normalizeAdPairs,
  parseAdPairKey,
} from "@/lib/ads";
import {
  addAd,
  listAds,
  listExchangerRatePairs,
  removeAd,
  updateAd,
} from "@/lib/store";
import type { AdPlacement, AdType } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAdBody(body: Record<string, unknown>) {
  const type = body.type as AdType;
  const placement = body.placement as AdPlacement;
  if (!type || !AD_TYPE_PLACEMENTS[type]) {
    return { error: "Укажите тип рекламы" } as const;
  }
  if (!placement || !AD_TYPE_PLACEMENTS[type].includes(placement)) {
    return { error: "Неверное место для этого типа" } as const;
  }

  const name = String(body.name ?? "").trim();
  const title = String(body.title ?? "").trim();
  const href = String(body.href ?? "").trim();
  if (name.length < 2) return { error: "Укажите название в админке" } as const;
  if (title.length < 2) return { error: "Укажите заголовок" } as const;
  if (href) {
    try {
      const u = new URL(href);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { error: "Ссылка рекламы: только http(s)" } as const;
      }
    } catch {
      return { error: "Некорректная ссылка рекламы" } as const;
    }
  }

  if (type === "highlight" || type === "rates_pin") {
    const exchangerId = String(body.exchangerId ?? "").trim();
    if (!exchangerId) {
      return { error: "Выберите обменник для этого формата" } as const;
    }
  }

  const imageUrl = String(body.imageUrl ?? "").trim();
  if (imageUrl) {
    // Allow local uploaded paths and absolute http(s) URLs.
    if (!imageUrl.startsWith("/api/ad-images/")) {
      try {
        const u = new URL(imageUrl);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          return { error: "URL картинки: только http(s)" } as const;
        }
      } catch {
        return { error: "Некорректный URL картинки" } as const;
      }
    }
  }

  let pairs: string[] = [];
  if (type === "rates_pin" || type === "highlight") {
    pairs = normalizeAdPairs(body.pairs);
    if (type === "rates_pin" && pairs.length) {
      for (const key of pairs) {
        if (!parseAdPairKey(key)) {
          return { error: `Некорректная пара: ${key}` } as const;
        }
      }
    }
    if (type === "highlight") {
      // Highlight lives on /exchangers — pair scope is only for rates_pin.
      pairs = [];
    }
  }

  return {
    data: {
      name,
      type,
      placement,
      title,
      body: String(body.body ?? "").trim(),
      href,
      imageUrl,
      exchangerId:
        type === "highlight" || type === "rates_pin"
          ? String(body.exchangerId ?? "").trim() || null
          : null,
      pairs,
      active: body.active !== false,
      priority: Number(body.priority) || 0,
      startsAt: body.startsAt ? String(body.startsAt) : null,
      endsAt: body.endsAt ? String(body.endsAt) : null,
    },
  } as const;
}

export async function GET(request: Request) {
  const denied = await assertAdminResource("ads", request.method);
  if (denied) return denied;

  const exchangerId = new URL(request.url).searchParams.get("exchangerId");
  if (exchangerId) {
    const pairs = await listExchangerRatePairs(exchangerId);
    return NextResponse.json({ pairs });
  }

  return NextResponse.json({ ads: await listAds() });
}

export async function POST(request: Request) {
  const denied = await assertAdminResource("ads", request.method);
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseAdBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (
    parsed.data.type === "rates_pin" &&
    parsed.data.pairs.length &&
    parsed.data.exchangerId
  ) {
    const available = await listExchangerRatePairs(parsed.data.exchangerId);
    const allowed = new Set(available.map((p) => p.key));
    const unknown = parsed.data.pairs.filter((k) => !allowed.has(k));
    if (unknown.length) {
      return NextResponse.json(
        {
          error: `Пары нет у обменника в XML: ${unknown.slice(0, 5).join(", ")}`,
        },
        { status: 400 },
      );
    }
  }

  const ad = await addAd(parsed.data);
  return NextResponse.json({ ad });
}

export async function PATCH(request: Request) {
  const denied = await assertAdminResource("ads", request.method);
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown> & {
    id?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Toggle-only shortcut
  if (
    typeof body.active === "boolean" &&
    body.type === undefined &&
    body.name === undefined &&
    body.resetStats === undefined
  ) {
    const ad = await updateAd(body.id, { active: body.active });
    if (!ad) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ad });
  }

  if (body.resetStats === true) {
    const { resetAdStats } = await import("@/lib/store");
    const ad = await resetAdStats(body.id);
    if (!ad) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ad });
  }

  const parsed = parseAdBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (
    parsed.data.type === "rates_pin" &&
    parsed.data.pairs.length &&
    parsed.data.exchangerId
  ) {
    const available = await listExchangerRatePairs(parsed.data.exchangerId);
    const allowed = new Set(available.map((p) => p.key));
    const unknown = parsed.data.pairs.filter((k) => !allowed.has(k));
    if (unknown.length) {
      return NextResponse.json(
        {
          error: `Пары нет у обменника в XML: ${unknown.slice(0, 5).join(", ")}`,
        },
        { status: 400 },
      );
    }
  }

  const ad = await updateAd(body.id, parsed.data);
  if (!ad) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ad });
}

export async function DELETE(request: Request) {
  const denied = await assertAdminResource("ads", request.method);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await removeAd(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
