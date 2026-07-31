<p align="center">
  <img src="public/gapsnap-mark.svg" alt="GapSnap" width="72" height="72" />
</p>

<h1 align="center">GapSnap</h1>

<p align="center">
  <strong>Мониторинг криптообменников</strong><br/>
  Курсы из XML-фидов · отзывы и жалобы · кабинет владельца · админка с ролями
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Drizzle" src="https://img.shields.io/badge/ORM-Drizzle-C5F74F?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="Version" src="https://img.shields.io/badge/version-2.25.0-0ea5e9?style=flat-square" />
</p>

---

> [!IMPORTANT]
> В примерах только **плейсхолдеры** (`YOUR_DOMAIN`, `YOUR_SERVER_IP`, `YOUR_REPO_URL`).  
> Прод-домены, IP серверов и секретный путь админки в документации **не публикуются**.

---

## Содержание

- [Обзор](#обзор)
- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Скрипты](#скрипты)
- [Данные и каталог](#данные-и-каталог)
- [Деплой](#деплой)
- [Обновление и бэкап](#обновление-и-бэкап)
- [Админка и роли](#админка-и-роли)
- [Почта](#почта)
- [Безопасность](#безопасность)
- [Структура репозитория](#структура-репозитория)

---

## Обзор

GapSnap собирает курсы обменников из публичных XML-фидов, показывает их на мониторинге и даёт операторам полный контур модерации: заявки, отзывы, жалобы, реклама, SEO и доступ владельцев в личный кабинет.

| | |
|:--|:--|
| **Публичный сайт** | Курсы, карточки обменников, новости, рекламные слоты |
| **Кабинет** `/cabinet` | Статистика, ответы на отзывы, 2FA владельца |
| **Админка** | Путь из `ADMIN_PATH` · RBAC · 2FA · журнал трафика |

---

## Возможности

<table>
<tr>
<td width="50%" valign="top">

### Мониторинг
- Парсинг и синхронизация XML-фидов  
- Каталог валют / городов / стран  
- Карточки обменников, логотипы  
- Баннер GapSnap на сайтах партнёров  

### Доверие
- Отзывы с модерацией и тредами  
- Magic-link ответы по email  
- Жалобы → очередь → ЧС вручную  
- Чёрный список  

</td>
<td width="50%" valign="top">

### Операции
- Кабинет владельца + 2FA  
- Журнал визитов: время, IP, устройство  
- Реклама: баннеры, тикер, закрепы, тарифы  
- Новости, ачивки, SEO, правовые страницы  

### Доступ
- 5 ролей админов  
- Временный пароль при создании  
- QR / TOTP онбординг  
- Bootstrap Owner из `.env`  

</td>
</tr>
</table>

---

## Архитектура

```mermaid
flowchart LR
  subgraph Public
    U[Пользователи]
    W[Сайт / курсы]
    C[Кабинет]
  end
  subgraph App
    N[Next.js]
    A[Админка]
  end
  subgraph Data
    P[(PostgreSQL)]
    F[XML-фиды]
  end
  U --> W
  U --> C
  W --> N
  C --> N
  A --> N
  N --> P
  N --> F
```

**Стек:** Next.js · React · PostgreSQL · Drizzle ORM · PM2 · Nginx

Хранилище — **только PostgreSQL** (в том числе логотипы и SVG ачивок). Миграции в `drizzle/` применяются при старте приложения.

---

## Требования

| Компонент | Версия / заметка |
|-----------|------------------|
| Node.js | **22+** |
| PostgreSQL | **16+** (Docker или системный пакет) |
| Прод | Nginx (или аналог), HTTPS, желательно edge/WAF |

---

## Быстрый старт

```bash
# 1. База
docker compose up -d

# 2. Приложение
npm install
cp .env.example .env
# отредактируйте .env — DATABASE_URL, ADMIN_*, SESSION_SECRET

npm run sync:catalogs   # опционально: seed-JSON справочников
npm run dev
```

| URL | Назначение |
|-----|------------|
| http://localhost:3000 | Публичный сайт |
| путь из `ADMIN_PATH` | Админ-панель |

> [!TIP]
> Не публикуйте `ADMIN_PATH` в `robots.txt`, маркетинге и скриншотах.

### Минимальный `.env`

```env
DATABASE_URL=postgresql://gapsnap:gapsnap@localhost:5432/gapsnap

ADMIN_LOGIN=admin
ADMIN_PASSWORD=change-me-to-a-long-random-password
SESSION_SECRET=change-me-to-at-least-24-random-chars

# В проде — свой секретный префикс:
# ADMIN_PATH=/ops-xxxx
```

Полный список переменных — в [`.env.example`](.env.example).

---

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Разработка |
| `npm run build` / `npm start` | Сборка и прод |
| `npm run sync:catalogs` | Обновить seed-JSON справочников |
| `npm run db:generate` | SQL-миграция из схемы |
| `npm run db:migrate` | Применить миграции вручную |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:import` | Импорт legacy `.data/store.json` + логотипов |
| `npm run db:seed-achievements` | Сид ачивок |

---

## Данные и каталог

```
PostgreSQL (bc_*)  ←  живой каталог, правки в админке
       ↑
seed JSON          ←  src/data/bestchange/*.json (если таблицы пустые)
       ↑
внешний API        ←  новые коды → очередь модерации → Sync
```

---

## Деплой

Типовой сценарий для Ubuntu. Подставьте свои значения:

| Плейсхолдер | Смысл |
|-------------|--------|
| `YOUR_SERVER_IP` | IP VPS |
| `YOUR_DOMAIN` | ваш домен |
| `YOUR_REPO_URL` | URL git-клона |
| `CHANGE_ME_DB_PASSWORD` | пароль роли БД |

<details>
<summary><strong>0. DNS</strong></summary>

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |

</details>

<details>
<summary><strong>1. Система · Node 22 · Nginx · PM2 · PostgreSQL</strong></summary>

```bash
ssh root@YOUR_SERVER_IP

apt update && apt upgrade -y && \
apt install -y curl git ufw nginx certbot python3-certbot-nginx postgresql postgresql-contrib && \
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
apt install -y nodejs && \
npm install -g pm2 && \
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

</details>

<details>
<summary><strong>2. PostgreSQL</strong></summary>

```bash
sudo -u postgres psql -c "CREATE USER gapsnap WITH PASSWORD 'CHANGE_ME_DB_PASSWORD';" && \
sudo -u postgres psql -c "CREATE DATABASE gapsnap OWNER gapsnap;" && \
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gapsnap TO gapsnap;" && \
sudo -u postgres psql -d gapsnap -c "GRANT ALL ON SCHEMA public TO gapsnap;"
```

</details>

<details>
<summary><strong>3. Клон и зависимости</strong></summary>

```bash
mkdir -p /var/www && cd /var/www && \
git clone YOUR_REPO_URL gapsnap && \
cd /var/www/gapsnap && npm install
```

</details>

<details>
<summary><strong>4. Окружение</strong></summary>

```bash
cd /var/www/gapsnap && cp .env.example .env && nano .env
```

```env
DATABASE_URL=postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap
ADMIN_LOGIN=...
ADMIN_PASSWORD=...       # длинный случайный
SESSION_SECRET=...       # ≥ 24 символов
ADMIN_PATH=/ops-xxxx     # свой секретный путь
SITE_URL=https://YOUR_DOMAIN
```

> [!CAUTION]
> Файл `.env` не коммитить в git.

</details>

<details>
<summary><strong>5. Сборка и PM2</strong></summary>

```bash
cd /var/www/gapsnap && \
npm run sync:catalogs && \
npm run build && \
pm2 start npm --name gapsnap -- start && \
pm2 save && \
pm2 startup systemd -u root --hp /root
```

Миграции применятся при старте. Вручную: `npm run db:migrate`.

```bash
pm2 status && pm2 logs gapsnap --lines 50
```

</details>

<details>
<summary><strong>6. Nginx</strong></summary>

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

</details>

<details>
<summary><strong>7. HTTPS</strong></summary>

Когда DNS уже указывает на сервер:

```bash
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN --redirect \
  -m admin@YOUR_DOMAIN --agree-tos -n
```

</details>

---

## Обновление и бэкап

### Обновление кода

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

Новые файлы в `drizzle/` подхватятся при рестарте.

<details>
<summary>Legacy-импорт JSON</summary>

```bash
# положите .data/store.json и .data/logos на сервер, затем:
cd /var/www/gapsnap && npm run db:import && pm2 restart gapsnap
```

</details>

### Бэкап PostgreSQL

```bash
pg_dump "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" \
  -Fc -f /root/gapsnap-$(date +%F).dump

pg_restore -d "postgresql://gapsnap:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/gapsnap" \
  --clean --if-exists /root/gapsnap-YYYY-MM-DD.dump
```

---

## Админка и роли

Путь панели — **`ADMIN_PATH`** в `.env`.

После первого входа (bootstrap Owner из env):

1. Включите **2FA** (QR / Authenticator)  
2. Создавайте админов — им выдаётся **временный пароль** и онбординг 2FA  

| Роль | Доступ |
|------|--------|
| **Owner** | Всё + админы, SEO, email, sync |
| **Moderator** | Обменники, отзывы, жалобы, ЧС, баннеры |
| **Editor** | Новости, качества, ачивки |
| **Ads** | Креативы и тарифы |
| **Viewer** | Только просмотр |

Кабинет владельца обменника: `/cabinet` (отдельная учётка, 2FA при одобрении заявки).

---

## Почта

Подтверждение отзывов, жалоб и писем владельцам — через SMTP API (`SMTPBZ_*` и аналоги в `.env.example`).

```env
SITE_URL=https://YOUR_DOMAIN
```

Отправитель должен быть верифицирован у провайдера.

---

## Безопасность

<table>
<tr>
<td width="50%" valign="top">

### Инфраструктура
- Edge / WAF перед origin  
- Origin не светить без прокси  
- Firewall — только edge IP  
- Длинные секреты + уникальный `ADMIN_PATH`  

</td>
<td width="50%" valign="top">

### Приложение
- Rate limit по IP (`RATE_LIMIT_*`)  
- Лимит размера тела  
- Один sync фидов за раз  
- SSRF-фильтр исходящих XML  
- `Retry-After` при 429  

</td>
</tr>
</table>

> [!WARNING]
> Не храните секреты в README, issues, чатах и скриншотах.

---

## Структура репозитория

```text
├── src/
│   ├── app/            # страницы и API routes
│   ├── components/     # UI: сайт · кабинет · админка
│   ├── lib/            # домен, RBAC, email, sync, security
│   └── db/             # Drizzle schema, seed
├── drizzle/            # SQL-миграции
├── public/             # статика
├── .env.example
└── README.md
```

---

<p align="center">
  <sub>Внутренний проект мониторинга · перед форком уберите <code>.env</code>, дампы БД и любые прод-домены/IP</sub>
</p>
