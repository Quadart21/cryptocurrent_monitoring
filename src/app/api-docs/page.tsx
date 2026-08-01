import type { Metadata } from "next";
import Link from "next/link";
import { ApiAccessForm } from "@/components/ApiAccessForm";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "API курсов",
  description:
    "GapSnap API — курсы обменников в формате BestChange v2. Документация и заявка на API-ключ.",
};

const ENDPOINTS = [
  { path: "/v2/{apiKey}/langs", desc: "Список языков API" },
  { path: "/v2/{apiKey}/groups/{lang}", desc: "Группы валют" },
  { path: "/v2/{apiKey}/countries/{lang}", desc: "Страны" },
  { path: "/v2/{apiKey}/cities/{lang}", desc: "Города" },
  { path: "/v2/{apiKey}/currencies/{lang}", desc: "Валюты (числовые ID)" },
  { path: "/v2/{apiKey}/changers/{lang}", desc: "Обменники" },
  {
    path: "/v2/{apiKey}/presences/{fromId}-{toId}",
    desc: "Наличие курсов по направлению",
  },
  {
    path: "/v2/{apiKey}/rates/{fromId}-{toId}",
    desc: "Курсы по паре (опц. -{cityId})",
  },
  {
    path: "/v2/{apiKey}/rates/{pairList}",
    desc: "Пакет до 500 пар через «+»",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { label: "API" },
        ]}
      />

      <div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          GapSnap API
        </h1>
        <p className="mt-2 text-sm text-ink-muted sm:text-base">
          Публичный API текущих курсов мониторинга GapSnap. Формат совместим с
          BestChange API v2: числовые ID валют/городов и те же пути{" "}
          <code className="text-ink">/v2/{"{apiKey}"}/…</code>. Доступ выдаётся
          по заявке.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Рекомендации
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
          <li>
            Для многих направлений используйте пакетный запрос через{" "}
            <code className="text-ink">+</code>, например{" "}
            <code className="break-all text-ink">
              /v2/{"{apiKey}"}/rates/305-89+31-12+30-53
            </code>{" "}
            (до 500 пар).
          </li>
          <li>Включайте Gzip в клиенте — ответы сжимаются.</li>
          <li>
            Лимит по умолчанию: 10 запросов в секунду на ключ. Повтор одних и
            тех же пар чаще раза в секунду неэффективен из‑за кеша.
          </li>
          <li>Для серии запросов держите keep-alive соединение.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Эндпоинты
        </h2>
        <p className="text-sm text-ink-muted">
          Base URL — адрес сайта GapSnap. Полная OpenAPI-схема:{" "}
          <Link
            href="/openapi-v2.yaml"
            className="text-accent hover:underline"
          >
            /openapi-v2.yaml
          </Link>
          .
        </p>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-line bg-bg-soft/60 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">GET</th>
                <th className="px-4 py-3 font-medium">Описание</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-ink sm:text-sm">
                    {ep.path}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-muted">
          Пример:{" "}
          <code className="break-all text-ink">
            GET /v2/gs_ваш_ключ/currencies/ru
          </code>
        </p>
      </section>

      <section className="space-y-3" id="apply">
        <h2 className="font-display text-xl font-semibold text-ink">
          Заявка на API-ключ
        </h2>
        <p className="text-sm text-ink-muted">
          Заполните форму — мы проверим заявку и отправим ключ на email. Без
          ключа эндпоинты возвращают 401.
        </p>
        <ApiAccessForm />
      </section>
    </div>
  );
}
