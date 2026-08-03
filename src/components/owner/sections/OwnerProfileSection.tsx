"use client";

import Link from "next/link";
import type { OwnerExchanger } from "@/components/owner/OwnerProvider";
import {
  OWNER_SUPPORT_TG,
  OWNER_SUPPORT_TG_URL,
  statusLabel,
  statusTone,
} from "@/components/owner/owner-utils";
import { contactHref } from "@/lib/site-contacts";
import {
  OwnerBadge,
  OwnerSectionCard,
} from "@/components/owner/OwnerUi";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-soft/40 p-3.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1.5 break-all text-sm text-ink">{children}</dd>
    </div>
  );
}

export function OwnerProfileSection({
  exchanger,
}: {
  exchanger: OwnerExchanger;
}) {
  const contactLink = contactHref(exchanger.contact);

  return (
    <div className="space-y-5">
      <OwnerSectionCard
        title="Профиль обменника"
        description="Данные после одобрения только для просмотра. Чтобы что-то изменить — напишите в поддержку."
        action={
          <OwnerBadge tone={statusTone(exchanger.status)}>
            {statusLabel(exchanger.status)}
          </OwnerBadge>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Название">{exchanger.name}</Field>
          <Field label="Статус на мониторинге">
            {statusLabel(exchanger.status)}
            {exchanger.verified ? " · проверен" : ""}
          </Field>
          <Field label="Сайт">
            {exchanger.website ? (
              <a
                href={exchanger.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                {exchanger.website}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Контакт">
            {exchanger.contact ? (
              contactLink ? (
                <a
                  href={contactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {exchanger.contact}
                </a>
              ) : (
                exchanger.contact
              )
            ) : (
              "—"
            )}
          </Field>
          <Field label="XML-фид">
            {exchanger.feedUrl ? (
              <a
                href={exchanger.feedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                {exchanger.feedUrl}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="В мониторинге с">
            {exchanger.workingSince || "ещё не одобрен"}
          </Field>
          <Field label="Последняя синхронизация">
            {exchanger.lastSyncAt
              ? new Date(exchanger.lastSyncAt).toLocaleString("ru-RU")
              : "—"}
          </Field>
          <Field label="Страница на GapSnap">
            <Link
              href={`/exchangers/${exchanger.slug}`}
              className="text-accent underline-offset-2 hover:underline"
            >
              /exchangers/{exchanger.slug}
            </Link>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Описание">
              {exchanger.description || "—"}
            </Field>
          </div>
        </dl>

        {exchanger.lastError ? (
          <p className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <strong className="font-semibold">Ошибка фида:</strong>{" "}
            {exchanger.lastError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
          <a
            href={OWNER_SUPPORT_TG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex min-h-11 items-center rounded-2xl px-4 py-2.5 text-sm font-semibold"
          >
            Написать в поддержку @{OWNER_SUPPORT_TG}
          </a>
          <Link
            href={`/exchangers/${exchanger.slug}`}
            className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-accent/40 hover:text-accent"
          >
            Публичная страница
          </Link>
        </div>
      </OwnerSectionCard>
    </div>
  );
}
