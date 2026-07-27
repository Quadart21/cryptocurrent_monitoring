import type { EmailSettings, EmailTemplate } from "@/lib/email/types";

const NOW = "2026-01-01T00:00:00.000Z";

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  fromEmail: "",
  fromName: "GapSnap",
  replyTo: "",
  notifyReviewConfirm: true,
  notifyOwnerExchangerApproved: true,
  notifyOwnerReviewApproved: true,
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

При входе: пароль + код из Authenticator.`,
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
];
