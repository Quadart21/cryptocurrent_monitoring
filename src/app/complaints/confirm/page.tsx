import Link from "next/link";
import { confirmComplaintEmail } from "@/lib/complaints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Подтверждение жалобы",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ComplaintConfirmPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";
  const complaint = token ? await confirmComplaintEmail(token) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="card space-y-4 p-6 sm:p-8">
        {complaint ? (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Жалоба принята
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              Жалоба на «{complaint.exchangerName}» подтверждена и отправлена
              модераторам GapSnap. Мы разберём её вручную.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Ссылка недействительна
            </h1>
            <p className="text-sm text-ink-muted">
              Токен устарел или уже использован. Если нужно — отправьте жалобу
              заново со страницы обменника.
            </p>
          </>
        )}
        <Link href="/" className="text-sm font-semibold text-accent">
          На главную
        </Link>
      </div>
    </div>
  );
}
