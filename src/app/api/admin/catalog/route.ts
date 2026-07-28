import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  deleteCity,
  deleteCountry,
  deleteCurrency,
  deleteGroup,
  ensureCatalogsHydrated,
  getCatalogSnapshot,
  upsertCity,
  upsertCountry,
  upsertCurrency,
  upsertGroup,
} from "@/lib/bestchange/catalog-store";
import type {
  BcCity,
  BcCountry,
  BcCurrency,
  BcGroup,
} from "@/lib/bestchange/catalog-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind = "currencies" | "cities" | "countries" | "groups";

function asKind(value: string | null): Kind | null {
  if (
    value === "currencies" ||
    value === "cities" ||
    value === "countries" ||
    value === "groups"
  ) {
    return value;
  }
  return null;
}

export async function GET(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  await ensureCatalogsHydrated();
  const snap = getCatalogSnapshot();
  const { searchParams } = new URL(request.url);
  const kind = asKind(searchParams.get("kind"));
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const filterText = (hay: string) =>
    !q || hay.toLowerCase().includes(q);

  if (kind === "currencies") {
    const items = Object.values(snap.currencies)
      .filter((c) =>
        filterText(`${c.code} ${c.name} ${c.nameEn} ${c.viewname}`),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
    return NextResponse.json({
      kind,
      meta: {
        fetchedAt: snap.fetchedAt,
        counts: snap.counts,
        source: snap.source,
      },
      items,
    });
  }

  if (kind === "cities") {
    const items = Object.values(snap.cities)
      .filter((c) =>
        filterText(
          `${c.code} ${c.name} ${c.nameEn} ${c.countryCode} ${c.countryName}`,
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return NextResponse.json({
      kind,
      meta: {
        fetchedAt: snap.fetchedAt,
        counts: snap.counts,
        source: snap.source,
      },
      items,
    });
  }

  if (kind === "countries") {
    const items = Object.values(snap.countries)
      .filter((c) => filterText(`${c.code} ${c.name} ${c.nameEn}`))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return NextResponse.json({
      kind,
      meta: {
        fetchedAt: snap.fetchedAt,
        counts: snap.counts,
        source: snap.source,
      },
      items,
    });
  }

  if (kind === "groups") {
    const items = snap.groups
      .filter((g) => filterText(`${g.id} ${g.name} ${g.nameEn}`))
      .sort((a, b) => a.id - b.id);
    return NextResponse.json({
      kind,
      meta: {
        fetchedAt: snap.fetchedAt,
        counts: snap.counts,
        source: snap.source,
      },
      items,
    });
  }

  return NextResponse.json({
    meta: {
      fetchedAt: snap.fetchedAt,
      counts: snap.counts,
      source: snap.source,
    },
  });
}

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    kind?: Kind;
    item?: Record<string, unknown>;
  };
  const kind = body.kind;
  const item = body.item;
  if (!kind || !item) {
    return NextResponse.json(
      { error: "kind and item required" },
      { status: 400 },
    );
  }

  try {
    if (kind === "currencies") {
      const code = String(item.code ?? "")
        .trim()
        .toUpperCase();
      if (!code || !item.name) {
        return NextResponse.json(
          { error: "code и name обязательны" },
          { status: 400 },
        );
      }
      const saved = await upsertCurrency({
        id: Number(item.id) || 0,
        code,
        name: String(item.name),
        nameEn: String(item.nameEn ?? ""),
        viewname: String(item.viewname ?? code),
        urlname: String(item.urlname ?? ""),
        crypto: Boolean(item.crypto),
        cash: Boolean(item.cash),
        groupId: Number(item.groupId) || 0,
        ps: Number(item.ps) || 0,
        defamt: Number(item.defamt) || 0,
        bigamt: Number(item.bigamt) || 0,
        rank: Number(item.rank) || 9999,
      } satisfies BcCurrency);
      return NextResponse.json({ item: saved });
    }

    if (kind === "cities") {
      const code = String(item.code ?? "")
        .trim()
        .toUpperCase();
      if (!code || !item.name) {
        return NextResponse.json(
          { error: "code и name обязательны" },
          { status: 400 },
        );
      }
      const saved = await upsertCity({
        id: Number(item.id) || 0,
        code,
        name: String(item.name),
        nameEn: String(item.nameEn ?? ""),
        countryId:
          item.countryId != null && item.countryId !== ""
            ? Number(item.countryId)
            : undefined,
        countryCode: String(item.countryCode ?? "").toUpperCase(),
        countryName: String(item.countryName ?? ""),
        rank: Number(item.rank) || 9999,
      } satisfies BcCity);
      return NextResponse.json({ item: saved });
    }

    if (kind === "countries") {
      const code = String(item.code ?? "")
        .trim()
        .toUpperCase();
      if (!code || !item.name) {
        return NextResponse.json(
          { error: "code и name обязательны" },
          { status: 400 },
        );
      }
      const saved = await upsertCountry({
        id: Number(item.id) || 0,
        code,
        name: String(item.name),
        nameEn: String(item.nameEn ?? ""),
        rank: Number(item.rank) || 9999,
      } satisfies BcCountry);
      return NextResponse.json({ item: saved });
    }

    if (kind === "groups") {
      const id = Number(item.id);
      if (!Number.isFinite(id) || !item.name) {
        return NextResponse.json(
          { error: "id и name обязательны" },
          { status: 400 },
        );
      }
      const saved = await upsertGroup({
        id,
        name: String(item.name),
        nameEn: String(item.nameEn ?? ""),
      } satisfies BcGroup);
      return NextResponse.json({ item: saved });
    }

    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const kind = asKind(searchParams.get("kind"));
  const code = searchParams.get("code");
  const idRaw = searchParams.get("id");

  if (!kind) {
    return NextResponse.json({ error: "kind required" }, { status: 400 });
  }

  let ok = false;
  if (kind === "currencies" && code) ok = await deleteCurrency(code);
  else if (kind === "cities" && code) ok = await deleteCity(code);
  else if (kind === "countries" && code) ok = await deleteCountry(code);
  else if (kind === "groups" && idRaw) ok = await deleteGroup(Number(idRaw));
  else {
    return NextResponse.json(
      { error: "code or id required" },
      { status: 400 },
    );
  }

  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
