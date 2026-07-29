import type { Metadata } from "next";
import { ApplyForm } from "@/components/ApplyForm";

export const metadata: Metadata = { title: "Добавить обменник" };

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Добавить обменник
        </h1>
        <p className="mt-2 text-sm text-ink-muted sm:text-base">
          Укажите публичный XML-фид курсов. Мы будем обновлять предложения
          каждую минуту.
        </p>
      </div>
      <ApplyForm />
    </div>
  );
}
