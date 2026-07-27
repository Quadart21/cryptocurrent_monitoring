import type { Metadata } from "next";
import { listBlacklist } from "@/lib/store";

export const metadata: Metadata = { title: "Чёрный список" };
export const revalidate = 60;

export default async function BlacklistPage() {
  const blacklisted = await listBlacklist();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Чёрный список
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Пункты с подтверждёнными жалобами: невыплаты, AML-скам, подмена курса.
        </p>
      </div>

      <ul className="space-y-4">
        {blacklisted.map((item) => (
          <li
            key={item.id}
            className="card border-danger/25 bg-[color-mix(in_srgb,var(--danger)_6%,var(--bg-elevated))] p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="font-display text-xl font-semibold text-ink">
                {item.name}
              </h2>
              <p className="text-xs text-ink-muted">
                {item.reports} жалоб · с {item.reportedAt}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {item.reason}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
