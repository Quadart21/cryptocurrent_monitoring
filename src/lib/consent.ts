/** Cookie consent (necessary always on; analytics optional). */

export const CONSENT_COOKIE = "gapsnap_consent";
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year

export type ConsentState = {
  v: number;
  /** Always true — theme, session, consent itself */
  necessary: true;
  /** GA / Metrika / GTM */
  analytics: boolean;
  ts: string;
};

export function parseConsentCookie(
  raw: string | null | undefined,
): ConsentState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (data.v !== CONSENT_VERSION) return null;
    if (typeof data.analytics !== "boolean") return null;
    return {
      v: CONSENT_VERSION,
      necessary: true,
      analytics: data.analytics,
      ts: typeof data.ts === "string" ? data.ts : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function encodeConsentCookie(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function makeConsent(analytics: boolean): ConsentState {
  return {
    v: CONSENT_VERSION,
    necessary: true,
    analytics,
    ts: new Date().toISOString(),
  };
}

export function readConsentFromDocument(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  return parseConsentCookie(match.slice(CONSENT_COOKIE.length + 1));
}

export function writeConsentToDocument(state: ConsentState) {
  if (typeof document === "undefined") return;
  const value = encodeConsentCookie(state);
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}
