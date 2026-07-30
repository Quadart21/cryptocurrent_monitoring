"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Reply = {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

type ReviewInfo = {
  id: string;
  exchangerName: string;
  exchangerSlug: string;
  text: string;
  sentiment: string;
  orderId: string;
  threadClosed: boolean;
  createdAt: string;
};

function roleLabel(role: string): string {
  if (role === "owner") return "Представитель обменника";
  if (role === "admin") return "Модератор GapSnap";
  return "Вы (автор отзыва)";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ReviewReplyClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [review, setReview] = useState<ReviewInfo | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Нет токена в ссылке");
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/reviews/thread?token=${encodeURIComponent(token)}`,
        );
        const body = (await res.json()) as {
          error?: string;
          review?: ReviewInfo;
          replies?: Reply[];
        };
        if (!res.ok) {
          setError(body.error ?? "Ссылка недействительна");
          return;
        }
        setReview(body.review ?? null);
        setReplies(body.replies ?? []);
      } catch {
        setError("Не удалось загрузить переписку");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/reviews/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reply }),
      });
      const body = (await res.json()) as {
        error?: string;
        replies?: Reply[];
      };
      if (!res.ok) {
        setError(body.error ?? "Не удалось отправить");
        return;
      }
      setReplies(body.replies ?? []);
      setReply("");
      setOk("Ответ отправлен. Обменник получит уведомление на email.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">Загрузка…</p>;
  }

  if (error && !review) {
    return (
      <div className="card space-y-3 p-6">
        <h1 className="font-display text-xl font-semibold text-ink">
          Ссылка не работает
        </h1>
        <p className="text-sm text-ink-muted">{error}</p>
        <Link href="/" className="text-sm font-semibold text-accent">
          На главную
        </Link>
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="card space-y-5 p-5 sm:p-7">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Переписка по отзыву
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
          {review.exchangerName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Заявка <code className="text-ink">{review.orderId}</code> ·{" "}
          {fmtDate(review.createdAt)}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-bg-soft/50 p-4">
        <p className="text-xs font-semibold text-ink-muted">Ваш отзыв</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{review.text}</p>
      </div>

      <div className="space-y-3">
        {replies.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-line px-4 py-3"
          >
            <p className="text-xs font-semibold text-accent-deep">
              {roleLabel(r.authorRole)}
              <span className="ml-2 font-normal text-ink-muted">
                {fmtDate(r.createdAt)}
              </span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">
              {r.body}
            </p>
          </div>
        ))}
      </div>

      {review.threadClosed ? (
        <p className="rounded-2xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink-muted">
          Обсуждение закрыто модератором. Новые ответы не принимаются.
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">
              Ваш ответ
            </span>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              required
              minLength={2}
              maxLength={2000}
              rows={4}
              className="w-full rounded-2xl border border-line bg-input px-3 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="Напишите ответ представителю обменника…"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {ok ? <p className="text-sm text-ok">{ok}</p> : null}
          <button
            type="submit"
            disabled={busy || reply.trim().length < 2}
            className="btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Отправить ответ
          </button>
        </form>
      )}

      <Link
        href={`/exchangers/${review.exchangerSlug}`}
        className="inline-flex text-sm font-semibold text-accent hover:underline"
      >
        Страница обменника →
      </Link>
    </div>
  );
}
