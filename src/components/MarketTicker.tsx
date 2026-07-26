import { getActiveRates, listExchangers } from "@/lib/store";
import { formatAmount } from "@/lib/format";

export async function MarketTicker() {
  const [rates, exchangers] = await Promise.all([
    getActiveRates(),
    listExchangers(),
  ]);
  const byId = new Map(exchangers.map((e) => [e.id, e]));

  const items = rates.slice(0, 16).map((offer) => {
    const ex = byId.get(offer.exchangerId);
    return {
      id: offer.id,
      text: `${ex?.name ?? "—"} · ${offer.from}/${offer.to} · ${formatAmount(offer.rate, offer.rate > 100 ? 2 : 4)}`,
    };
  });

  const loop =
    items.length > 0
      ? [...items, ...items]
      : [
          { id: "wait", text: "Ожидание синхронизации XML-фидов…" },
          { id: "wait2", text: "Курсы обновляются каждую минуту" },
        ];

  return (
    <div className="border-t border-line/60 bg-accent-deep text-white">
      <div className="overflow-hidden py-2.5">
        <div className="ticker-track flex w-max gap-10 whitespace-nowrap px-4 text-xs sm:text-sm">
          {loop.map((item, i) => (
            <span key={`${item.id}-${i}`} className="opacity-90">
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
