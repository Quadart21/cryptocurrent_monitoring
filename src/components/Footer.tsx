import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line/70 bg-bg-elevated/60 sm:mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-ink">GapSnap</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            Независимый мониторинг обменных пунктов. Мы не проводим обмен и не
            храним средства — помогаем выбрать надёжный сервис по курсу и
            репутации.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
          <Link href="/exchangers" className="hover:text-accent-deep">
            Обменники
          </Link>
          <Link href="/advertise" className="hover:text-accent-deep">
            Реклама
          </Link>
          <Link href="/apply" className="hover:text-accent-deep">
            Добавить
          </Link>
          <Link href="/cabinet" className="hover:text-accent-deep">
            Кабинет
          </Link>
          <Link href="/blacklist" className="hover:text-accent-deep">
            Чёрный список
          </Link>
        </div>
      </div>
    </footer>
  );
}
