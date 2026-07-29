# GapSnap

Мониторинг обменников: курсы из публичных XML-фидов, опрос раз в минуту.

**Хранилище:** PostgreSQL. Миграции Drizzle применяются автоматически при старте приложения (`src/instrumentation.ts`). Логотипы и SVG ачивок лежат в БД.

---

## Требования

- Node.js 22+
- PostgreSQL 16+ (локально через Docker или системный пакет)

---

## Локальный запуск

```bash
# 1. Postgres
docker compose up -d

# 2. Приложение
npm install
cp .env.example .env
```

В `.env` минимум:

```env
DATABASE_URL=postgresql://gapsnap:gapsnap@localhost:5432/gapsnap
ADMIN_LOGIN=admin
ADMIN_PASSWORD=change-me-to-a-long-random-password
SESSION_SECRET=change-me-to-at-least-24-random-chars
```

```bash
npm run sync:catalogs
npm run dev
```

`sync:catalogs` обновляет seed-JSON в `src/data/bestchange/` (для репозитория). Живой каталог сайта — в PostgreSQL и правится в админке.

Справочники валют (коды, города, страны):
- живой каталог: таблицы PostgreSQL (`bc_currencies`, `bc_cities`, `bc_countries`, `bc_groups`)
- seed при первом старте из `src/data/bestchange/*.json` (если таблицы пустые)
- правка в админке: **/trulala/catalog**
- новые коды с внешнего API: очередь на модерацию → **Синхронизация** (поллер раз в 12ч); после одобрения пишутся в БД

Сайт: http://localhost:3000  
Админка: http://localhost:3000/trulala

При первом старте создаются таблицы и сиды (Kubex, blacklist, тарифы, SEO).

### Импорт старых данных из JSON

Если есть `.data/store.json` и `.data/logos/`:

```bash
npm run db:import
```

### Скрипты БД

| Команда | Назначение |
|---------|------------|
| `npm run db:generate` | Сгенерировать SQL-миграцию из схемы |
| `npm run db:migrate` | Применить миграции вручную |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:import` | Импорт `.data/store.json` + логотипов в Postgres |

---

## Развёртка на чистом сервере (Ubuntu)

**Пример:** домен `gapsnap.org`, IP `2.26.89.254`, репозиторий `https://github.com/Quadart21/cryptocurrent_monitoring.git`.

### 0. DNS

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | `2.26.89.254` |
| A | `www` | `2.26.89.254` |

### 1. Подключение

```bash
ssh root@2.26.89.254
```

### 2. Система + Node 22 + Nginx + PM2 + Certbot + PostgreSQL

```bash
apt update && apt upgrade -y && \
apt install -y curl git ufw nginx certbot python3-certbot-nginx postgresql postgresql-contrib && \
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
apt install -y nodejs && \
npm install -g pm2 && \
node -v && npm -v && \
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

### 3. База PostgreSQL

Задай свой пароль вместо `CHANGE_ME_DB_PASSWORD`:

```bash
sudo -u postgres psql -c "CREATE USER gapsnap WITH PASSWORD 'CHANGE_ME_DB_PASSWORD';" && \
sudo -u postgres psql -c "CREATE DATABASE gapsnap OWNER gapsnap;" && \
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gapsnap TO gapsnap;" && \
sudo -u postgres psql -d gapsnap -c "GRANT ALL ON SCHEMA public TO gapsnap;"
```

Проверка:

```bash
psql "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" -c "SELECT version();"
```

### 4. Клон и зависимости

```bash
mkdir -p /var/www && \
cd /var/www && \
git clone https://github.com/Quadart21/cryptocurrent_monitoring.git gapsnap && \
cd /var/www/gapsnap && \
npm install
```

### 5. `.env`

```bash
cd /var/www/gapsnap && \
cp .env.example .env && \
nano .env
```

Обязательно:

```env
DATABASE_URL=postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap

ADMIN_LOGIN=admin
ADMIN_PASSWORD=длинный-случайный-пароль
SESSION_SECRET=ещё-один-секрет-не-короче-24-символов

# опционально — ключ внешнего каталога валют
BESTCHANGE_API_KEY=
BESTCHANGE_API_BASE=https://bestchange.app
```

Сохрани файл (`Ctrl+O`, Enter, `Ctrl+X`).

### 6. Каталоги валют + сборка

```bash
cd /var/www/gapsnap && \
npm run sync:catalogs && \
npm run build
```

Таблицы создадутся при первом запуске PM2 (автомиграция). Если нужно применить миграции заранее:

```bash
cd /var/www/gapsnap && npm run db:migrate
```

### 7. PM2

```bash
cd /var/www/gapsnap && \
pm2 start npm --name gapsnap -- start && \
pm2 save && \
pm2 startup systemd -u root --hp /root
```

Выполни команду, которую выведет `pm2 startup`, если попросит.

Проверка:

```bash
pm2 status && pm2 logs gapsnap --lines 50
```

В логах не должно быть ошибок `DATABASE_URL` / connection refused. После старта видны применённые миграции и seed.

### 8. Nginx

```bash
cat > /etc/nginx/sites-available/gapsnap <<'EOF'
server {
    listen 80;
    server_name gapsnap.org www.gapsnap.org;

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

Проверка по IP: http://2.26.89.254

### 9. HTTPS

Когда DNS уже указывает на сервер:

```bash
certbot --nginx -d gapsnap.org -d www.gapsnap.org --redirect -m admin@gapsnap.org --agree-tos -n
```

Сайт: https://gapsnap.org

---

## Обновление на сервере

```bash
cd /var/www/gapsnap && \
git pull && \
npm install && \
npm run build && \
pm2 restart gapsnap
```

Новые SQL-миграции из папки `drizzle/` применятся сами при рестарте.

Если переносишь данные с другой машины (JSON):

```bash
# скопируй .data/store.json и .data/logos на сервер, затем:
cd /var/www/gapsnap && npm run db:import && pm2 restart gapsnap
```

---

## Бэкап Postgres

```bash
# дамп
pg_dump "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" -Fc -f /root/gapsnap-$(date +%F).dump

# восстановление
pg_restore -d "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" --clean --if-exists /root/gapsnap-YYYY-MM-DD.dump
```

---

## Админка

Скрытый адрес: `/trulala`

- `/trulala` — обзор
- `/trulala/exchangers` — обменники
- `/trulala/reviews` — отзывы
- `/trulala/qualities` — теги качеств
- `/trulala/achievements` — ачивки (SVG)
- `/trulala/ads` — реклама
- `/trulala/seo` — SEO
- `/trulala/email` — email (шаблоны, smtp.bz, журнал)
- `/trulala/blacklist` — чёрный список
- `/trulala/sync` — синхронизация фидов

Логин/пароль: `ADMIN_LOGIN` / `ADMIN_PASSWORD` в `.env`.  
В production обязательны длинный `ADMIN_PASSWORD` и `SESSION_SECRET` (≥24 символов).

### Email (smtp.bz)

Подтверждение отзывов и письмо владельцу при одобрении обменника:

```env
SITE_URL=https://gapsnap.org
SMTPBZ_API_KEY=ваш_ключ_из_кабинета
SMTPBZ_FROM=noreply@ваш-домен   # верифицированный отправитель в smtp.bz
SMTPBZ_FROM_NAME=GapSnap
```

Отправитель должен быть подтверждён в кабинете smtp.bz.

При **Одобрить** в админке на `ownerEmail` уходят: логин, временный пароль, секрет 2FA (TOTP). Вход в `/cabinet` — пароль + код из Authenticator.

При **одобрении отзыва** владельцу уходит письмо «новый отзыв — ответьте в кабинете».

---

## Защита от DoS / DDoS

Объёмный DDoS приложение само не отразит — нужен edge (Cloudflare):

1. Сайт за Cloudflare (базовый DDoS + WAF).
2. Under Attack Mode при инциденте, Bot Fight Mode, rate limit на `/api/*`.
3. Origin закрыт от прямого доступа (firewall: только IP Cloudflare).

На уровне GapSnap:

- лимиты по IP на `/api/*` (`RATE_LIMIT_*` в `.env`);
- лимит размера тела;
- один sync фидов одновременно;
- SSRF-фильтр исходящих запросов к XML.

При 429 клиент получает `Retry-After`.
