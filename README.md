# Cryptomon

Мониторинг обменников: курсы из BestChange-совместимых XML-фидов (`valuta.xml`), опрос раз в минуту.

## Запуск

```bash
npm install
cp .env.example .env
npm run sync:catalogs
npm run dev
```

## Админка

Скрытый адрес: `/trulala`

Разделы:
- `/trulala` — обзор и очереди
- `/trulala/exchangers` — обменники
- `/trulala/reviews` — модерация отзывов
- `/trulala/qualities` — теги качеств
- `/trulala/achievements` — ачивки (SVG у названий)
- `/trulala/ads` — реклама (баннеры, тикер, хайлайты)
- `/trulala/blacklist` — чёрный список
- `/trulala/sync` — синхронизация фидов

Логин/пароль в `.env`: `ADMIN_LOGIN` / `ADMIN_PASSWORD` (по умолчанию `admin` / `admin`).
