"use client";

import Script from "next/script";
import { preconnect, prefetchDNS } from "react-dom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

type TurnstileApi = {
  render: (
    el: string | HTMLElement,
    options: Record<string, unknown>,
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

export function isTurnstileClientEnabled() {
  return Boolean(SITE_KEY);
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  {
    action?: string;
    onToken: (token: string | null) => void;
    className?: string;
  }
>(function TurnstileWidget(
  { action = "owner-login", onToken, className },
  ref,
) {
  if (SITE_KEY) {
    preconnect("https://challenges.cloudflare.com");
    prefetchDNS("https://challenges.cloudflare.com");
  }

  const { theme } = useTheme();
  const reactId = useId().replace(/:/g, "");
  const containerId = `cf-turnstile-${reactId}`;
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.turnstile),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const cleanup = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    }
    widgetIdRef.current = null;
  }, []);

  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !window.turnstile) return;
    const el = document.getElementById(containerId);
    if (!el) return;

    cleanup();
    el.innerHTML = "";
    onTokenRef.current(null);

    try {
      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        theme: theme === "light" ? "light" : "dark",
        action,
        language: "ru",
        callback: (token: string) => {
          setError(null);
          onTokenRef.current(token);
        },
        "error-callback": () => {
          setError("Не удалось загрузить проверку. Обновите страницу.");
          onTokenRef.current(null);
        },
        "expired-callback": () => {
          onTokenRef.current(null);
        },
        "timeout-callback": () => {
          onTokenRef.current(null);
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      });
      setError(null);
    } catch {
      setError("Не удалось показать проверку Cloudflare");
    }
  }, [action, cleanup, containerId, theme]);

  const reset = useCallback(() => {
    onTokenRef.current(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
        return;
      } catch {
        /* fall through */
      }
    }
    renderWidget();
  }, [renderWidget]);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    if (!SITE_KEY || !scriptReady) return;
    renderWidget();
    return cleanup;
  }, [SITE_KEY, scriptReady, renderWidget, cleanup]);

  if (!SITE_KEY) {
    return (
      <p className={`text-xs text-ink-muted ${className ?? ""}`}>
        Turnstile не настроен (нет NEXT_PUBLIC_TURNSTILE_SITE_KEY).
      </p>
    );
  }

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() =>
          setError("Не удалось загрузить скрипт Cloudflare Turnstile")
        }
      />
      <div
        id={containerId}
        className="flex min-h-[65px] items-center justify-center"
      />
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
});
