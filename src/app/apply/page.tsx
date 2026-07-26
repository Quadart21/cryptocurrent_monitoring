import type { Metadata } from "next";
import { ApplyForm } from "@/components/ApplyForm";

export const metadata: Metadata = { title: "Добавить обменник" };

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Добавить обменник
        </h1>
        <p className="mt-2 text-ink-muted">
          Укажите публичный XML-фид BestChange (`valuta.xml`). Курсы будут
          обновляться каждую минуту.
        </p>
      </div>
      <ApplyForm />
    </div>
  );
}
