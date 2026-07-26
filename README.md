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

Логин/пароль в `.env`: `ADMIN_LOGIN` / `ADMIN_PASSWORD` (по умолчанию `admin` / `admin`).
