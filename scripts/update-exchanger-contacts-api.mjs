/**
 * Update exchanger description + contact email via GapSnap admin HTTP API.
 * Use when local DATABASE_URL cannot reach production Postgres.
 *
 * Usage:
 *   node --env-file=.env scripts/update-exchanger-contacts-api.mjs
 *   node --env-file=.env scripts/update-exchanger-contacts-api.mjs --apply
 *
 * Needs ADMIN_LOGIN + ADMIN_PASSWORD (prod). Optional BASE_URL (default https://gapsnap.org).
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";

const DEFAULT_FILE = path.join(
  process.cwd(),
  "scripts/data/exchanger-contact-updates.json",
);

function normalizeHost(urlOrHost) {
  const raw = String(urlOrHost || "").trim();
  if (!raw) return "";
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^www\./, "").toLowerCase();
  }
}

function cookieFromResponse(res) {
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    return setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  const raw = res.headers.get("set-cookie") || "";
  return raw
    .split(",")
    .map((p) => p.split(";")[0].trim())
    .filter((x) => x.includes("="))
    .join("; ");
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileIdx = args.indexOf("--file");
  const file =
    fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1] : DEFAULT_FILE;

  const BASE = (process.env.BASE_URL || "https://gapsnap.org").replace(
    /\/$/,
    "",
  );
  const login = process.env.ADMIN_LOGIN?.trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!login || !password) {
    console.error("ADMIN_LOGIN and ADMIN_PASSWORD are required");
    process.exit(1);
  }

  const updates = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(updates)) {
    console.error("Update file must be a JSON array");
    process.exit(1);
  }

  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      Referer: `${BASE}/trulala`,
    },
    body: JSON.stringify({ login, password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    console.error(
      "Admin login failed:",
      loginRes.status,
      loginBody.error || JSON.stringify(loginBody),
    );
    process.exit(1);
  }
  const cookie = cookieFromResponse(loginRes);
  if (!cookie) {
    console.error("Admin login ok but no session cookie");
    process.exit(1);
  }

  const listRes = await fetch(`${BASE}/api/admin/exchangers`, {
    headers: { Cookie: cookie, Origin: BASE, Referer: `${BASE}/trulala` },
  });
  const listBody = await listRes.json();
  const existing = listBody.exchangers || [];
  if (!listRes.ok) {
    console.error("Failed to list exchangers", listRes.status, listBody);
    process.exit(1);
  }

  const byHost = new Map();
  for (const row of existing) {
    const host = normalizeHost(row.website);
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(row);
  }

  let matched = 0;
  let updated = 0;
  let missing = 0;

  for (const upd of updates) {
    const domain = normalizeHost(upd.domain || upd.website || "");
    const description = String(upd.description ?? "").trim();
    const email = String(upd.email ?? "").trim().toLowerCase();
    const hits = byHost.get(domain) || [];
    if (!hits.length) {
      console.log(`MISSING  ${domain}`);
      missing++;
      continue;
    }
    const row = hits[0];
    matched++;
    const patch = { id: row.id, description };
    if (email) patch.contact = email;

    const changed =
      (row.description || "") !== description ||
      (email && (row.contact || "").trim().toLowerCase() !== email);

    console.log(
      `${changed ? "UPDATE" : "SAME  "}  ${domain} (${row.slug}) → ${email || "—"}`,
    );

    if (!apply || !changed) continue;

    const res = await fetch(`${BASE}/api/admin/exchangers`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: BASE,
        Referer: `${BASE}/trulala/exchangers`,
      },
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`FAIL    ${domain}`, res.status, body.error || body);
      continue;
    }
    updated++;
  }

  console.log(
    `\nDone matched=${matched} updated=${updated} missing=${missing}` +
      (apply ? " [APPLIED]" : " [dry-run, pass --apply to write]"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
