import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import {
  contactHref,
  telegramDisplay,
  telegramHref,
} from "@/lib/site-contacts";
import { getSeoSettings } from "@/lib/store";

export const metadata: Metadata = {
  title: "Партнёрская программа",
  description:
    "Приводите обменников на GapSnap и получайте вознаграждение за размещение.",
};

export default async function PartnersPage() {
  const seo = await getSeoSettings();
  const email = seo.contactEmail.trim();
  const telegram = telegramDisplay(seo.contactTelegram);
  const emailLink = email ? contactHref(email) : null;
  const telegramLink = telegramHref(seo.contactTelegram);

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
        Напишите с пометкой «партнёрка»
        {emailLink ? (
          <>
            {" "}
            на{" "}
            <a href={emailLink} className="text-accent hover:underline">
              {email}
            </a>
          </>
        ) : null}
        {telegramLink ? (
          <>
            {emailLink ? " или в " : " в "}
            <a
              href={telegramLink}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Telegram {telegram}
            </a>
          </>
        ) : null}
        {!emailLink && !telegramLink ? (
          <>
            {" "}
            на контакт из{" "}
            <Link href="/advertise" className="text-accent hover:underline">
              раздела рекламы
            </Link>
          </>
        ) : null}
        . Telegram-бот с алертами курсов — в планах; пока следите за обновлениями
        в блоге.
      </p>
    </div>
  );
}
