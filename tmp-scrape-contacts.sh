#!/bin/bash
set -euo pipefail
UA='Mozilla/5.0 (compatible; GapSnapBot/1.0; +https://gapsnap.org)'
scrape() {
  local name="$1"; shift
  echo "===== $name ====="
  local emails="" tgs="" title="" desc=""
  for url in "$@"; do
    html=$(curl -sS -L --max-time 25 -A "$UA" "$url" 2>/dev/null || true)
    [ -z "$html" ] && continue
    if [ -z "$title" ]; then
      title=$(printf '%s' "$html" | tr '\n' ' ' | sed -n 's/.*<title[^>]*>\([^<]*\)<\/title>.*/\1/ip' | head -1 | sed 's/  */ /g')
    fi
    if [ -z "$desc" ]; then
      desc=$(printf '%s' "$html" | tr '\n' ' ' | sed -n 's/.*name=["'\'']description["'\''][^>]*content=["'\'']\([^"'\'']*\)["'\''].*/\1/ip' | head -1)
      if [ -z "$desc" ]; then
        desc=$(printf '%s' "$html" | tr '\n' ' ' | sed -n 's/.*content=["'\'']\([^"'\'']*\)["'\''][^>]*name=["'\'']description["'\''].*/\1/ip' | head -1)
      fi
    fi
    found=$(printf '%s' "$html" | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | grep -viE 'example|sentry|wixpress|schema|cloudflare|noreply|png$|jpg$|svg$' || true)
    emails=$(printf '%s\n%s' "$emails" "$found" | sed '/^$/d' | sort -u)
    tg=$(printf '%s' "$html" | grep -oE 't\.me/[A-Za-z0-9_]+' | sort -u || true)
    tgs=$(printf '%s\n%s' "$tgs" "$tg" | sed '/^$/d' | sort -u)
  done
  echo "title: $title"
  echo "desc: $desc"
  echo "emails:"
  echo "$emails"
  echo "tg:"
  echo "$tgs"
  echo
}

scrape "mine.exchange" \
  "https://mine.exchange/" "https://mine.exchange/en/" "https://mine.exchange/contacts" "https://mine.exchange/en/contacts" "https://mine.exchange/ru/contacts"

scrape "coindrop.trade" \
  "https://coindrop.trade/" "https://coindrop.trade/en/" "https://coindrop.trade/en/contacts" "https://coindrop.trade/contacts"

scrape "365cash.co" \
  "https://365cash.co/" "https://365cash.co/en/" "https://365cash.co/contacts" "https://365cash.co/en/contacts" "https://365cash.co/page/contacts"

scrape "nixexchange.net" \
  "https://nixexchange.net/" "https://nixexchange.net/en/" "https://nixexchange.net/contacts" "https://nixexchange.net/en/contacts"

scrape "coincat.in" \
  "https://coincat.in/" "https://coincat.in/en/" "https://coincat.in/contacts" "https://coincat.in/en/contacts" "https://coincat.in/page/contacts"

scrape "daeo.pro" \
  "https://daeo.pro/" "https://daeo.pro/en/" "https://daeo.pro/contacts" "https://daeo.pro/en/contacts"

scrape "obmenko.org" \
  "https://obmenko.org/" "https://obmenko.org/en/" "https://obmenko.org/contacts" "https://obmenko.org/en/contacts" "https://obmenko.org/page/contacts"

scrape "e-change.io" \
  "https://e-change.io/" "https://e-change.io/en/" "https://e-change.io/contacts" "https://e-change.io/en/contacts"

scrape "receive-money.biz" \
  "https://receive-money.biz/" "https://www.receive-money.biz/" "https://receive-money.biz/en/" "https://www.receive-money.biz/en/contacts" "https://receive-money.biz/contacts"

scrape "xchange.pub" \
  "https://xchange.pub/" "https://xchange.pub/en/" "https://xchange.pub/contacts" "https://xchange.pub/en/contacts" "https://xchange.pub/page/contacts"
