import type {
  AchievementMode,
  AchievementRule,
  AchievementRuleKind,
} from "@/lib/store-types";

export const ACHIEVEMENT_RULE_KINDS: Array<{
  kind: AchievementRuleKind;
  label: string;
  hint: string;
}> = [
  {
    kind: "verified",
    label: "Проверенный",
    hint: "Флаг verified у обменника",
  },
  {
    kind: "rating_min",
    label: "Мин. рейтинг",
    hint: "Рейтинг и опционально число отзывов",
  },
  {
    kind: "reviews_min",
    label: "Мин. отзывов",
    hint: "Число одобренных отзывов",
  },
  {
    kind: "age_years_min",
    label: "Мин. возраст (лет)",
    hint: "Поле ageYears",
  },
  {
    kind: "pair_count_min",
    label: "Мин. направлений",
    hint: "Число пар в фиде",
  },
  {
    kind: "not_blacklisted",
    label: "Не в ЧС",
    hint: "Нет записи в чёрном списке",
  },
  {
    kind: "sync_fresh",
    label: "Свежий синк",
    hint: "lastSyncAt не старше N часов",
  },
  {
    kind: "newcomer",
    label: "Новичок",
    hint: "approvedAt за последние N дней (+ опц. рейтинг)",
  },
  {
    kind: "positive_ratio_min",
    label: "Доля позитивных",
    hint: "positive / total и мин. отзывов",
  },
  {
    kind: "reserve_sum_min",
    label: "Сумма резервов",
    hint: "Сумма reserve по всем курсам",
  },
];

export type AchievementSignals = {
  verified: boolean;
  rating: number;
  reviews: number;
  reviewsPositive: number;
  reviewsNegative: number;
  ageYears: number;
  pairCount: number;
  approvedAt: string | null;
  lastSyncAt: string | null;
  blacklisted: boolean;
  reserveSum: number;
  nowMs?: number;
};

const KINDS = new Set<AchievementRuleKind>(
  ACHIEVEMENT_RULE_KINDS.map((k) => k.kind),
);

function num(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

export function parseAchievementMode(raw: unknown): AchievementMode {
  return raw === "auto" ? "auto" : "manual";
}

export function parseAchievementRule(raw: unknown): AchievementRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as AchievementRuleKind)) {
    return null;
  }
  const rule: AchievementRule = { kind: kind as AchievementRuleKind };
  const minRating = num(o.minRating);
  const minReviews = num(o.minReviews);
  const minAgeYears = num(o.minAgeYears);
  const minPairs = num(o.minPairs);
  const maxSyncAgeHours = num(o.maxSyncAgeHours);
  const maxAgeDays = num(o.maxAgeDays);
  const minPositiveRatio = num(o.minPositiveRatio);
  const minReserveSum = num(o.minReserveSum);
  if (minRating !== undefined) rule.minRating = minRating;
  if (minReviews !== undefined) rule.minReviews = minReviews;
  if (minAgeYears !== undefined) rule.minAgeYears = minAgeYears;
  if (minPairs !== undefined) rule.minPairs = minPairs;
  if (maxSyncAgeHours !== undefined) rule.maxSyncAgeHours = maxSyncAgeHours;
  if (maxAgeDays !== undefined) rule.maxAgeDays = maxAgeDays;
  if (minPositiveRatio !== undefined) rule.minPositiveRatio = minPositiveRatio;
  if (minReserveSum !== undefined) rule.minReserveSum = minReserveSum;
  return rule;
}

/** Validate rule has required thresholds for its kind. */
export function validateAchievementRule(
  mode: AchievementMode,
  rule: AchievementRule | null,
): string | null {
  if (mode !== "auto") return null;
  if (!rule) return "Для авто-режима задайте правило";
  switch (rule.kind) {
    case "verified":
    case "not_blacklisted":
      return null;
    case "rating_min":
      if (rule.minRating === undefined) return "Укажите мин. рейтинг";
      return null;
    case "reviews_min":
      if (rule.minReviews === undefined) return "Укажите мин. число отзывов";
      return null;
    case "age_years_min":
      if (rule.minAgeYears === undefined) return "Укажите мин. возраст (лет)";
      return null;
    case "pair_count_min":
      if (rule.minPairs === undefined) return "Укажите мин. число направлений";
      return null;
    case "sync_fresh":
      if (rule.maxSyncAgeHours === undefined)
        return "Укажите макс. возраст синка (часы)";
      return null;
    case "newcomer":
      if (rule.maxAgeDays === undefined)
        return "Укажите макс. возраст (дни с одобрения)";
      return null;
    case "positive_ratio_min":
      if (rule.minPositiveRatio === undefined)
        return "Укажите мин. долю позитивных (0–1)";
      return null;
    case "reserve_sum_min":
      if (rule.minReserveSum === undefined) return "Укажите мин. сумму резервов";
      return null;
    default:
      return "Неизвестный тип правила";
  }
}

export function evaluateAchievementRule(
  rule: AchievementRule,
  s: AchievementSignals,
): boolean {
  const now = s.nowMs ?? Date.now();

  switch (rule.kind) {
    case "verified":
      return s.verified;
    case "rating_min": {
      if ((rule.minRating ?? 0) > s.rating) return false;
      if (rule.minReviews !== undefined && s.reviews < rule.minReviews)
        return false;
      return true;
    }
    case "reviews_min":
      return s.reviews >= (rule.minReviews ?? 0);
    case "age_years_min":
      return s.ageYears >= (rule.minAgeYears ?? 0);
    case "pair_count_min":
      return s.pairCount >= (rule.minPairs ?? 0);
    case "not_blacklisted":
      return !s.blacklisted;
    case "sync_fresh": {
      if (!s.lastSyncAt) return false;
      const syncMs = Date.parse(s.lastSyncAt);
      if (!Number.isFinite(syncMs)) return false;
      const maxH = rule.maxSyncAgeHours ?? 2;
      return now - syncMs <= maxH * 3_600_000;
    }
    case "newcomer": {
      if (!s.approvedAt) return false;
      const approvedMs = Date.parse(s.approvedAt);
      if (!Number.isFinite(approvedMs)) return false;
      const maxD = rule.maxAgeDays ?? 30;
      if (now - approvedMs > maxD * 86_400_000) return false;
      if (rule.minRating !== undefined && s.rating < rule.minRating)
        return false;
      if (rule.minReviews !== undefined && s.reviews < rule.minReviews)
        return false;
      return true;
    }
    case "positive_ratio_min": {
      if (rule.minReviews !== undefined && s.reviews < rule.minReviews)
        return false;
      if (s.reviews <= 0) return false;
      const ratio = s.reviewsPositive / s.reviews;
      return ratio >= (rule.minPositiveRatio ?? 0);
    }
    case "reserve_sum_min":
      return s.reserveSum >= (rule.minReserveSum ?? 0);
    default:
      return false;
  }
}

export function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}
