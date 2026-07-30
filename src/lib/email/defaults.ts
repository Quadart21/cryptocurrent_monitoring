import type { EmailSettings, EmailTemplate } from "@/lib/email/types";

const NOW = "2026-01-01T00:00:00.000Z";

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  fromEmail: "",
  fromName: "GapSnap",
  replyTo: "",
  notifyReviewConfirm: true,
  notifyOwnerExchangerApproved: true,
  notifyOwnerReviewApproved: true,
  notifyReviewThreadAuthor: true,
  notifyReviewThreadOwner: true,
  notifyComplaintConfirm: true,
  updatedAt: NOW,
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "review_confirm",
    name: "Подтверждение отзыва",
    description: "Письмо автору отзыва со ссылкой подтверждения",
    subject: "{{siteName}}: подтвердите отзыв",
    text: `Вы оставили отзыв о «{{exchangerName}}» на {{siteName}}.

Подтвердите email: {{confirmUrl}}

Заявка: {{orderId}}
Ссылка действует 24 часа.`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p>Вы оставили отзыв о обменнике <strong>{{exchangerName}}</strong> на {{siteName}}.</p>
  <p>Заявка: <code>{{orderId}}</code></p>
  <p><a href="{{confirmUrl}}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Подтвердить отзыв</a></p>
  <p style="font-size:13px;color:#555">Или откройте ссылку:<br/><a href="{{confirmUrl}}">{{confirmUrl}}</a></p>
  <p style="font-size:13px;color:#555">Ссылка действует 24 часа.</p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "owner_approved",
    name: "Одобрение обменника",
    description: "Доступ в кабинет + 2FA после модерации",
    subject: "{{siteName}}: обменник одобрен — доступ в кабинет",
    text: `Ваш обменник «{{exchangerName}}» одобрен на {{siteName}}.

Кабинет: {{cabinetUrl}}
Логин: {{ownerLogin}}
Временный пароль: {{tempPassword}}

2FA секрет: {{totpSecret}}
otpauth: {{totpUri}}

При входе: пароль + код из Authenticator.

{{bannerHint}}`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>Ваш обменник <strong>{{exchangerName}}</strong> одобрен на {{siteName}}.</p>
  <p><a href="{{cabinetUrl}}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Открыть кабинет</a></p>
  <h3 style="margin:24px 0 8px;font-size:16px">Данные для входа</h3>
  <ul>
    <li>Логин: <code>{{ownerLogin}}</code></li>
    <li>Временный пароль: <code>{{tempPassword}}</code></li>
    <li>Адрес: <a href="{{cabinetUrl}}">{{cabinetUrl}}</a></li>
  </ul>
  <h3 style="margin:24px 0 8px;font-size:16px">2FA</h3>
  <p>Секрет: <code>{{totpSecret}}</code></p>
  <p style="font-size:13px;color:#555;word-break:break-all">{{totpUri}}</p>
  <h3 style="margin:24px 0 8px;font-size:16px">Баннер GapSnap</h3>
  <p>{{bannerHint}}</p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "owner_new_review",
    name: "Новый отзыв владельцу",
    description: "Уведомление после публикации отзыва",
    subject: "{{siteName}}: новый отзыв на «{{exchangerName}}» — ответьте",
    text: `На «{{exchangerName}}» опубликован новый отзыв ({{sentimentLabel}}).

Заявка: {{orderId}}

{{reviewText}}

Ответить: {{cabinetUrl}}
Страница: {{publicUrl}}`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>На обменник <strong>{{exchangerName}}</strong> пришёл новый отзыв.</p>
  <p>Оценка: <strong>{{sentimentLabel}}</strong><br/>Заявка: <code>{{orderId}}</code></p>
  <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0f766e;background:#f8fafc">{{reviewText}}</blockquote>
  <p><a href="{{cabinetUrl}}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Ответить в кабинете</a></p>
  <p style="font-size:13px;color:#555"><a href="{{publicUrl}}">{{publicUrl}}</a></p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "owner_banner_missing",
    name: "Баннер не найден — предупреждение",
    description: "Владельцу: разместите кнопку GapSnap на сайте",
    subject: "{{siteName}}: разместите баннер на сайте «{{exchangerName}}»",
    text: `Здравствуйте.

На сайте обменника «{{exchangerName}}» ({{website}}) мы не нашли кнопку GapSnap.

По правилам мониторинга баннер обязателен. Код и инструкции — в кабинете: {{cabinetUrl}}

HTML для вставки:
{{bannerHtml}}

Пропусков подряд: {{misses}}. Если баннер не появится, обменник могут снять с публикации.

— {{siteName}}`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>На сайте обменника <strong>{{exchangerName}}</strong> (<a href="{{website}}">{{website}}</a>) мы не нашли кнопку GapSnap.</p>
  <p>По правилам мониторинга баннер обязателен. Скопируйте код в кабинете и разместите на сайте (обычно в футере).</p>
  <p><a href="{{cabinetUrl}}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Открыть кабинет</a></p>
  <h3 style="margin:24px 0 8px;font-size:16px">HTML для вставки</h3>
  <pre style="padding:12px;background:#f8fafc;border-radius:10px;overflow:auto;font-size:12px;white-space:pre-wrap">{{bannerHtml}}</pre>
  <p style="font-size:13px;color:#555">Пропусков подряд: <strong>{{misses}}</strong>. Если баннер не появится, обменник могут снять с публикации на {{siteName}}.</p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "owner_banner_unpublished",
    name: "Снятие с публикации — нет баннера",
    description: "Владельцу: обменник снят за отсутствие кнопки GapSnap",
    subject: "{{siteName}}: «{{exchangerName}}» снят с публикации",
    text: `Здравствуйте.

Обменник «{{exchangerName}}» снят с публикации на {{siteName}}: на сайте {{website}} не найдена кнопка GapSnap.

Вернуть листинг можно после размещения баннера — код в кабинете: {{cabinetUrl}}

{{bannerHtml}}

Напишите в поддержку после размещения — мы проверим и восстановим карточку.

— {{siteName}}`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>Обменник <strong>{{exchangerName}}</strong> снят с публикации на {{siteName}}.</p>
  <p>Причина: на сайте <a href="{{website}}">{{website}}</a> не найдена кнопка GapSnap.</p>
  <p>Разместите баннер и напишите в поддержку — мы проверим и восстановим карточку.</p>
  <p><a href="{{cabinetUrl}}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Открыть кабинет</a></p>
  <h3 style="margin:24px 0 8px;font-size:16px">HTML для вставки</h3>
  <pre style="padding:12px;background:#f8fafc;border-radius:10px;overflow:auto;font-size:12px;white-space:pre-wrap">{{bannerHtml}}</pre>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "review_owner_replied",
    name: "Ответ на ваш отзыв",
    description: "Автору отзыва: реакция обменника/модератора + ссылка ответить",
    subject: "{{siteName}}: ответ по отзыву на «{{exchangerName}}»",
    text: `По вашему отзыву на «{{exchangerName}}» пришёл ответ ({{roleLabel}}).

{{replyText}}

Ответить: {{replyUrl}}
Страница: {{publicUrl}}

Ссылка для ответа действует 14 дней.`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>По вашему отзыву на <strong>{{exchangerName}}</strong> пришёл ответ (<strong>{{roleLabel}}</strong>).</p>
  <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #6d28d9;background:#f8fafc">{{replyText}}</blockquote>
  <p><a href="{{replyUrl}}" style="display:inline-block;padding:12px 18px;background:#6d28d9;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Ответить на реакцию</a></p>
  <p style="font-size:13px;color:#555">Ссылка действует 14 дней. Страница обменника: <a href="{{publicUrl}}">{{publicUrl}}</a></p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "review_author_replied",
    name: "Автор отзыва ответил",
    description: "Владельцу: продолжение переписки по отзыву",
    subject: "{{siteName}}: автор отзыва ответил — «{{exchangerName}}»",
    text: `Автор отзыва продолжил переписку по «{{exchangerName}}».

{{replyText}}

Ответить в кабинете: {{cabinetUrl}}
Страница: {{publicUrl}}`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>Автор отзыва ответил по обменнику <strong>{{exchangerName}}</strong>.</p>
  <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0f766e;background:#f8fafc">{{replyText}}</blockquote>
  <p><a href="{{cabinetUrl}}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Ответить в кабинете</a></p>
  <p style="font-size:13px;color:#555"><a href="{{publicUrl}}">{{publicUrl}}</a></p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "complaint_confirm",
    name: "Подтверждение жалобы",
    description: "Автору жалобы: подтвердите email",
    subject: "{{siteName}}: подтвердите жалобу на «{{exchangerName}}»",
    text: `Вы отправили жалобу на «{{exchangerName}}» на {{siteName}}.

Подтвердите email: {{confirmUrl}}

Ссылка действует 24 часа.`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
  <p>Вы отправили жалобу на обменник <strong>{{exchangerName}}</strong> на {{siteName}}.</p>
  <p><a href="{{confirmUrl}}" style="display:inline-block;padding:12px 18px;background:#dc2626;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Подтвердить жалобу</a></p>
  <p style="font-size:13px;color:#555">Ссылка действует 24 часа.</p>
</div>`,
    enabled: true,
    updatedAt: NOW,
  },
];
