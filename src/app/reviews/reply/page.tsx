import { Suspense } from "react";
import { ReviewReplyClient } from "@/components/reviews/ReviewReplyClient";

export const metadata = {
  title: "Ответ на отзыв",
  robots: { index: false, follow: false },
};

export default function ReviewReplyPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-ink-muted">Загрузка…</p>}>
        <ReviewReplyClient />
      </Suspense>
    </div>
  );
}
