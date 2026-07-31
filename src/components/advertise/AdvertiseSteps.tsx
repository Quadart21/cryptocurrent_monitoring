const STEPS = [
  {
    n: "01",
    title: "Выберите формат",
    body: "Баннер, бегущая строка, закреп в курсах или выделение в списке — под задачу и бюджет.",
  },
  {
    n: "02",
    title: "Пришлите макет",
    body: "Файл по размеру слота и желаемые даты. Подскажем, если нужно подогнать креатив.",
  },
  {
    n: "03",
    title: "Запуск и статистика",
    body: "Размещение в выбранном слоте, ротация при нескольких креативах, показы и CTR.",
  },
] as const;

export function AdvertiseSteps() {
  return (
    <section className="space-y-5" aria-labelledby="advertise-steps-heading">
      <div>
        <h2
          id="advertise-steps-heading"
          className="font-display text-2xl font-semibold text-ink"
        >
          Как это работает
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Три шага от заявки до показа аудитории мониторинга.
        </p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="rounded-2xl border border-line bg-bg-elevated/60 p-5"
          >
            <p className="font-display text-xs font-semibold tracking-[0.16em] text-accent uppercase">
              {step.n}
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-ink">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
