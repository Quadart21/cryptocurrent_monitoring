import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "Партнёрская программа",
  description:
    "Приводите обменников на GapSnap и получайте вознаграждение за размещение.",
};

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { label: "Партнёрам" },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold text-ink">
        Партнёрская программа
      </h1>
      <p className="text-ink-muted">
        Рекомендуйте GapSnap обменникам: за успешную заявку и оплату рекламного
        слота — вознаграждение. Условия фиксируем индивидуально.
      </p>
      <div className="card space-y-3 p-5 text-sm text-ink-muted">
        <p>
          · Процент от первого рекламного платежа привлечённого обменника
        </p>
        <p>· Прозрачный статус заявок в переписке с менеджером</p>
        <p>· Выплаты USDT TRC20 или на карту по согласованию</p>
      </div>
      <p className="text-sm text-ink-muted">
        Напишите на контакт из{" "}
        <Link href="/advertise" className="text-accent hover:underline">
          раздела рекламы
        </Link>{" "}
        с пометкой «партнёрка». Telegram-бот с алертами курсов — в планах; пока
        следите за обновлениями в блоге.
      </p>
    </div>
  );
}
