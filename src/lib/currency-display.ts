/** Client-safe currency label from dashboard options (code → display name). */
export function currencyOptionLabel(
  code: string,
  options: Array<{ code: string; name: string }>,
): string {
  const hit = options.find((c) => c.code.toUpperCase() === code.toUpperCase());
  const name = hit?.name?.trim();
  return name || code;
}

export type CurrencyGroupBucket<
  T extends { groupId?: number; groupName?: string },
> = {
  groupId: number;
  groupName: string;
  items: T[];
};

/** Preferred BestChange group order for selects. */
const GROUP_ORDER = [0, 1, 2, 3, 4, 5];

export function groupCurrencyOptions<
  T extends { groupId?: number; groupName?: string; name: string },
>(options: T[]): CurrencyGroupBucket<T>[] {
  const map = new Map<number, CurrencyGroupBucket<T>>();
  for (const item of options) {
    const groupId = typeof item.groupId === "number" ? item.groupId : -1;
    const groupName = item.groupName?.trim() || "Другое";
    let bucket = map.get(groupId);
    if (!bucket) {
      bucket = { groupId, groupName, items: [] };
      map.set(groupId, bucket);
    }
    bucket.items.push(item);
  }

  const buckets = [...map.values()];
  buckets.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.groupId);
    const bi = GROUP_ORDER.indexOf(b.groupId);
    const ao = ai === -1 ? 100 + a.groupId : ai;
    const bo = bi === -1 ? 100 + b.groupId : bi;
    if (ao !== bo) return ao - bo;
    return a.groupName.localeCompare(b.groupName, "ru");
  });
  for (const bucket of buckets) {
    bucket.items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  return buckets;
}
