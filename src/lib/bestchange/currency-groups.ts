import type { BcCurrency, BcGroup } from "@/lib/bestchange/catalog-types";
import bundledGroups from "@/data/bestchange/groups.json";
import bundledCurrencyByCode from "@/data/bestchange/currency-by-code.json";

const BUNDLED_GROUPS = bundledGroups as BcGroup[];
const BUNDLED_CURRENCIES = bundledCurrencyByCode as Record<string, BcCurrency>;

const bundledGroupNameById = new Map(
  BUNDLED_GROUPS.map((g) => [g.id, g.name] as const),
);

/** Resolve group id/name, preferring bundled catalog when DB is incomplete. */
export function resolveCurrencyGroup(input: {
  code: string;
  groupId?: number | null;
}): { groupId: number; groupName: string } {
  const code = input.code.toUpperCase();
  const bundled = BUNDLED_CURRENCIES[code];
  const fromInput =
    typeof input.groupId === "number" && Number.isFinite(input.groupId)
      ? input.groupId
      : null;
  const groupId =
    typeof bundled?.groupId === "number"
      ? bundled.groupId
      : (fromInput ?? 0);
  const groupName =
    bundledGroupNameById.get(groupId) ||
    (groupId < 0 ? "Другое" : `Группа ${groupId}`);
  return { groupId, groupName };
}

export function bundledGroupList(): BcGroup[] {
  return BUNDLED_GROUPS;
}
