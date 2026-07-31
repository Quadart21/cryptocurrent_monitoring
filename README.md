# GapSnap

Мониторинг криптообменников: актуальные курсы из публичных XML-фидов, отзывы, жалобы, кабинет владельца и админ-панель.

> Репозиторий рассчитан на самостоятельный деплой. В документации ниже — **плейсхолдеры** (`YOUR_DOMAIN`, `YOUR_SERVER_IP`). Подставьте свои значения; чужие домены и IP в README не указываются намеренно.

---

## Возможности

| Область | Что есть |
|--------|----------|
| **Курсы** | Парсинг XML-фидов, синхронизация, каталог валют/городов |
| **Обменники** | Заявки, модерация, логотипы, баннер GapSnap на сайтах партнёров |
| **Отзывы** | Модерация, треды ответов, magic-link по email |
| **Жалобы** | Очередь в админке, ЧС только после решения модератора |
| **Кабинет** | Статистика, ответы на отзывы, 2FA для владельца |
| **Трафик** | Просмотры/клики: сводка по дням + журнал (время, IP, устройство) |
| **Реклама** | Баннеры, тикер, закрепы, тарифы |
| **Контент** | Новости, ачивки, SEO, правовые страницы |
| **Админы** | Роли (Owner / Moderator / Editor / Ads / Viewer), 2FA, временные пароли |

Стек: **Next.js**, **React**, **PostgreSQL**, **Drizzle ORM**, **PM2** (типичный прод).

---

## Требования

- Node.js **22+**
- PostgreSQL **16+** (Docker или системный пакет)
- Для продакшена: Nginx (или аналог), HTTPS, желательно edge/WAF (например Cloudflare)

---

## Быстрый старт (локально)

```bash
# 1. База
docker compose up -d

# 2. Приложение
npm install
cp .env.example .env
# отредактируйте .env — минимум DATABASE_URL, ADMIN_*, SESSION_SECRET

npm run sync:catalogs   # опционально: обновить seed-JSON справочников
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Админ-панель доступна по пути из `ADMIN_PATH` в `.env` (см. `.env.example`). Не публикуйте этот путь в robots.txt и публичных материалах.

При первом старте миграции Drizzle применяются автоматически (`src/instrumentation.ts`), создаются таблицы и базовые сиды.

### Минимальный `.env`

```env
DATABASE_URL=postgresql://gapsnap:gapsnap@localhost:5432/gapsnap

ADMIN_LOGIN=admin
ADMIN_PASSWORD=change-me-to-a-long-random-password
SESSION_SECRET=change-me-to-at-least-24-random-chars

# Рекомендуется в проде: нестандартный префикс админки
# ADMIN_PATH=/ops-xxxx
```

Полный список переменных — в `.env.example`.

---

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Разработка |
| `npm run build` / `npm start` | Сборка и прод-режим |
| `npm run sync:catalogs` | Обновить seed-JSON справочников валют |
| `npm run db:generate` | SQL-миграция из схемы Drizzle |
| `npm run db:migrate` | Применить миграции вручную |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:import` | Импорт legacy `.data/store.json` + логотипов |
| `npm run db:seed-achievements` | Сид ачивок |

---

## Данные и каталог

- Живой каталог валют/городов/стран — в PostgreSQL (`bc_*`).
- Seed при пустых таблицах — из `src/data/bestchange/*.json`.
- Правка — в админке (раздел каталога).
- Новые коды с внешнего API — очередь модерации в разделе синхронизации.

Хранилище приложения — **только PostgreSQL** (в т.ч. логотипы и SVG ачивок).

---

## Развёртка на сервере (Ubuntu)

Ниже — типовой сценарий. Замените плейсхолдеры:

| Плейсхолдер | Пример смысла |
|-------------|----------------|
| `YOUR_SERVER_IP` | IP VPS |
| `YOUR_DOMAIN` | ваш домен |
| `YOUR_REPO_URL` | URL git-клона |
| `CHANGE_ME_DB_PASSWORD` | пароль роли БД |

### 0. DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |

### 1. Система

```bash
ssh root@YOUR_SERVER_IP

apt update && apt upgrade -y && \
apt install -y curl git ufw nginx certbot python3-certbot-nginx postgresql postgresql-contrib && \
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
apt install -y nodejs && \
npm install -g pm2 && \
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

### 2. PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER gapsnap WITH PASSWORD 'CHANGE_ME_DB_PASSWORD';" && \
sudo -u postgres psql -c "CREATE DATABASE gapsnap OWNER gapsnap;" && \
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gapsnap TO gapsnap;" && \
sudo -u postgres psql -d gapsnap -c "GRANT ALL ON SCHEMA public TO gapsnap;"
```

### 3. Код и зависимости

```bash
mkdir -p /var/www && cd /var/www && \
git clone YOUR_REPO_URL gapsnap && \
cd /var/www/gapsnap && npm install
```

### 4. Окружение

```bash
cd /var/www/gapsnap && cp .env.example .env && nano .env
```

Обязательно задайте:

```env
DATABASE_URL=postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap
ADMIN_LOGIN=...
ADMIN_PASSWORD=...          # длинный случайный
SESSION_SECRET=...          # ≥ 24 символов
ADMIN_PATH=/ops-xxxx        # свой секретный путь
SITE_URL=https://YOUR_DOMAIN
```

Не коммитьте `.env` в git.

### 5. Сборка и PM2

```bash
cd /var/www/gapsnap && \
npm run sync:catalogs && \
npm run build && \
pm2 start npm --name gapsnap -- start && \
pm2 save && \
pm2 startup systemd -u root --hp /root
```

Миграции применятся при старте. При необходимости заранее: `npm run db:migrate`.

```bash
pm2 status && pm2 logs gapsnap --lines 50
```

### 6. Nginx

```bash
cat > /etc/nginx/sites-available/gapsnap <<'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/gapsnap /etc/nginx/sites-enabled/gapsnap && \
rm -f /etc/nginx/sites-enabled/default && \
nginx -t && systemctl reload nginx
```

### 7. HTTPS

Когда DNS уже указывает на сервер:

```bash
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN --redirect \
  -m admin@YOUR_DOMAIN --agree-tos -n
```

---

## Обновление

```bash
cd /var/www/gapsnap && \
cp .env .env.bak && \
git fetch origin && \
git reset --hard origin/main && \
cp .env.bak .env && \
npm install && \
npm run build && \
pm2 restart gapsnap
```

Новые файлы в `drizzle/` подхватятся при рестарте (автомиграция).

Legacy-импорт JSON:

```bash
# положите .data/store.json и .data/logos на сервер, затем:
cd /var/www/gapsnap && npm run db:import && pm2 restart gapsnap
```

---

## Бэкап PostgreSQL

```bash
pg_dump "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" \
  -Fc -f /root/gapsnap-$(date +%F).dump

pg_restore -d "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" \
  --clean --if-exists /root/gapsnap-YYYY-MM-DD.dump
```

---

## Админка и роли

Путь задаётся через **`ADMIN_PATH`**. После деплоя войдите учёткой из env (bootstrap Owner) и:

1. Включите **2FA** (QR / Authenticator).
2. Создавайте остальных админов — им выдаётся **временный пароль** (смена при первом входе) и онбординг 2FA.

| Роль | Кратко |
|------|--------|
| **Owner** | Всё + управление админами, SEO, email, sync |
| **Moderator** | Обменники, отзывы, жалобы, ЧС, баннеры |
| **Editor** | Новости, качества, ачивки |
| **Ads** | Креативы и тарифы |
| **Viewer** | Только просмотр |

Кабинет владельца обменника: `/cabinet` (отдельная учётка, 2FA при одобрении заявки).

---

## Почта

Подтверждение отзывов, жалоб, писем владельцам — через SMTP API (см. переменные `SMTPBZ_*` / аналоги в `.env.example`).

Задайте `SITE_URL=https://YOUR_DOMAIN` — ссылки в письмах строятся от него. Отправитель должен быть верифицирован у провайдера.

---

## Безопасность

**Инфраструктура**

- Edge/WAF перед origin (Cloudflare и т.п.).
- Origin не светить в DNS без прокси; firewall — только доверенные IP edge.
- Длинные `ADMIN_PASSWORD`, `SESSION_SECRET`; уникальный `ADMIN_PATH`.

**В приложении**

- Rate limit по IP на `/api/*` (`RATE_LIMIT_*`).
- Лимит размера тела запросов.
- Один sync фидов за раз; SSRF-фильтр исходящих XML.
- При 429 — заголовок `Retry-After`.

Не храните секреты в README, issues и скриншотах.

---

## Структура (кратко)

```
src/app/          # страницы и API routes
src/components/   # UI (публичный, кабинет, админка)
src/lib/          # домен, RBAC, email, sync, security
src/db/           # schema Drizzle, seed
drizzle/          # SQL-миграции
```

---

## Лицензия и вклад

Приватный/внутренний проект мониторинга. Перед публикацией форков уберите `.env`, дампы БД и любые прод-домены/IP из документации.
