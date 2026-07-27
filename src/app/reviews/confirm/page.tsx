"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Подтверждаем отзыв…");
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("В ссылке нет токена подтверждения.");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(
          `/api/reviews/confirm?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          error?: string;
          message?: string;
          review?: { exchangerSlug?: string };
        };
        if (!res.ok) {
          setState("error");
          setMessage(data.error ?? "Не удалось подтвердить отзыв");
          return;
        }
        setState("ok");
        setMessage(data.message ?? "Email подтверждён");
        setSlug(data.review?.exchangerSlug ?? null);
      } catch {
        setState("error");
        setMessage("Сеть недоступна. Попробуйте позже.");
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="card space-y-4 p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Подтверждение отзыва
        </h1>
        <p
          className={`text-sm ${
            state === "error" ? "text-danger" : "text-ink-muted"
          }`}
        >
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {slug && (
            <Link
              href={`/exchangers/${slug}`}
              className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold"
            >
              К обменнику
            </Link>
          )}
          <Link
            href="/"
            className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ReviewConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-ink-muted">
          Подтверждаем отзыв…
        </div>
      }
    >
      <ConfirmInner />
    </Suspense>
  );
}
