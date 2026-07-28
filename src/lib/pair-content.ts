import { currencyLabel } from "@/lib/bestchange/catalog";

export type PairFaq = { q: string; a: string };

export function buildPairDescription(input: {
  from: string;
  to: string;
  offerCount: number;
  bestRate: number | null;
  worstRate: number | null;
  siteName?: string;
}): string {
  const fromL = currencyLabel(input.from);
  const toL = currencyLabel(input.to);
  const brand = input.siteName?.trim() || "GapSnap";
  const count = input.offerCount;
  const best = input.bestRate;
  const worst = input.worstRate;

  const parts: string[] = [
    `Актуальный курс ${fromL} (${input.from}) к ${toL} (${input.to}) на ${brand}.`,
  ];

  if (count > 0 && best != null) {
    parts.push(
      `Сейчас ${count} ${pluralOffers(count)} в мониторинге; лучший курс — ${formatRate(best)} ${input.to} за 1 ${input.from}.`,
    );
  } else {
    parts.push(
      `Сравните предложения обменников, резервы и отзывы по направлению ${input.from} → ${input.to}.`,
    );
  }

  if (count > 1 && best != null && worst != null && best > worst) {
    const spreadPct = ((best - worst) / worst) * 100;
    if (Number.isFinite(spreadPct) && spreadPct > 0.05) {
      parts.push(
        `Разброс курсов около ${spreadPct.toFixed(2)}% — выбирайте выгодный вариант.`,
      );
    }
  }

  parts.push("Мы не проводим обмен и не храним средства.");
  return parts.join(" ");
}

export function buildPairFaqs(input: {
  from: string;
  to: string;
  offerCount: number;
  bestRate: number | null;
}): PairFaq[] {
  const fromL = currencyLabel(input.from);
  const toL = currencyLabel(input.to);
  const best =
    input.bestRate != null
      ? `${formatRate(input.bestRate)} ${input.to}`
      : "смотрите таблицу ниже";

  return [
    {
      q: `Какой сейчас курс ${input.from} к ${input.to}?`,
      a: `Лучший курс среди мониторируемых обменников: ${best}. На странице таблица обновляется автоматически.`,
    },
    {
      q: `Сколько обменников предлагают ${fromL} → ${toL}?`,
      a:
        input.offerCount > 0
          ? `Сейчас в выдаче ${input.offerCount} ${pluralOffers(input.offerCount)}. Сортируйте по курсу, резерву или рейтингу.`
          : `Пока нет активных предложений по этой паре — попробуйте другое направление или зайдите позже.`,
    },
    {
      q: "Как выбрать безопасный обменник?",
      a: "Смотрите рейтинг и отзывы с email-подтверждением, бейдж «проверен», резерв и лимиты. При сомнениях сверьте сервис с чёрным списком GapSnap.",
    },
    {
      q: "GapSnap меняет валюту сам?",
      a: "Нет. GapSnap — независимый мониторинг курсов. Обмен проходит на сайте выбранного обменника.",
    },
  ];
}

function pluralOffers(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "обменник";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "обменника";
  return "обменников";
}

function formatRate(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 8 });
}
