"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { AdminSecurityCard } from "@/components/admin/AdminSecurityCard";

const LATER_KEY = "gs_admin_totp_later";

export function AdminTotpGate({
  mode = "blocking",
  onDismiss,
}: {
  /** blocking = full-screen until done/later; inline = embeddable card */
  mode?: "blocking" | "inline";
  onDismiss?: () => void;
}) {
  const { busy, setBusy, refresh, me } = useAdmin();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const body = (await res.json()) as {
        error?: string;
        totpSecret?: string;
        totpUri?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось начать настройку");
        return;
      }
      setSecret(body.totpSecret ?? null);
      setUri(body.totpUri ?? null);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }, [setBusy]);

  useEffect(() => {
    void start();
  }, [start]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Неверный код");
        return;
      }
      sessionStorage.removeItem(LATER_KEY);
      await refresh();
      onDismiss?.();
    } finally {
      setBusy(false);
    }
  }

  function later() {
    sessionStorage.setItem(LATER_KEY, "1");
    onDismiss?.();
  }

  const card = (
    <AdminSecurityCard
      title="Подключите двухфакторную защиту"
      subtitle="Один раз настройте приложение-аутентификатор — вход станет безопаснее."
      steps={[
        {
          title: "Откройте Authenticator",
          detail: "Google Authenticator, 1Password, Authy или аналог на телефоне.",
        },
        {
          title: "Отсканируйте QR",
          detail: "Или введите секрет вручную, если камера недоступна.",
          done: Boolean(secret),
        },
        {
          title: "Введите 6-значный код",
          detail: "Код обновляется каждые 30 секунд — подтвердит, что всё верно.",
        },
      ]}
      login={me?.login}
      totpSecret={secret}
      totpUri={uri}
      code={code}
      onCodeChange={setCode}
      onConfirm={() => void confirm()}
      onLater={later}
      busy={busy || loading}
      error={error}
    />
  );

  if (mode === "inline") return card;

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-3xl">{card}</div>
    </div>
  );
}

export function wasTotpDeferred(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(LATER_KEY) === "1";
}
