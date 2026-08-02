#!/bin/bash
set -euo pipefail
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

probe() {
  local url="$1"
  echo "---- $url ----"
  html=$(curl -sS -L --max-time 25 -A "$UA" -H 'Accept-Language: ru,en;q=0.9' "$url" 2>/dev/null | head -c 500000 || true)
  if [ -z "$html" ]; then echo "(empty)"; return; fi
  echo "$html" | tr '\n' ' ' | sed -n 's/.*<title[^>]*>\([^<]*\)<\/title>.*/TITLE: \1/ip' | head -1
  echo "$html" | grep -oiE 'mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|t\.me/[A-Za-z0-9_]+' \
    | sed 's/^mailto://I' \
    | grep -viE 'example|wixpress|sentry|cloudflare|schema|png$|jpg$|webp$|svg$|auth@|login@gmail|user@gmail|@2x' \
    | sort -u | head -40
}

for url in \
  'https://mine.exchange/' \
  'https://mineex.com/' \
  'https://obmenko.org/' \
  'https://obmenko.org/ru/' \
  'https://obmenko.org/page/contacts/' \
  'https://nixexchange.net/page/contacts' \
  'https://nixexchange.net/ru/contacts' \
  'https://coindrop.trade/page/contacts' \
  'https://coindrop.trade/ru/contacts' \
  'https://coindrop.trade/en/contacts' \
  'https://www.receive-money.biz/' \
  'https://www.receive-money.biz/ru/' \
  'https://www.receive-money.biz/page/contacts' \
  'https://xchange.pub/page/contacts' \
  'https://xchange.pub/ru/contacts' \
  'https://e-change.io/page/contacts' \
  'https://e-change.io/ru/contacts' \
  'https://365cash.co/page/contacts' \
  'https://daeo.pro/page/contacts' \
  'https://coincat.in/page/contacts'
do
  probe "$url"
  echo
done
