import type { EmailSettings, EmailTemplate } from "@/lib/email/types";
import {
  emailCodeBlock,
  emailHighlight,
  emailQuote,
  wrapEmailHtml,
} from "@/lib/email/layout";

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
  notifyApiKeyApproved: true,
  updatedAt: NOW,
};

const p = (html: string, extraStyle = "") =>
  `<p style="margin:0 0 16px${extraStyle ? `;${extraStyle}` : ""}">${html}</p>`;
const muted = (html: string) =>
  p(html, "color:#6a6578;font-size:14px;margin:0");

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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `Вы оставили отзыв о обменнике <strong>{{exchangerName}}</strong> на <strong style="color:#6d28d9">{{siteName}}</strong>.`,
        ),
        emailHighlight(
          `Заявка: <code style="font-size:13px">{{orderId}}</code><br/>Чтобы отзыв появился на сайте, подтвердите email по кнопке ниже.`,
        ),
        muted("Ссылка действует 24 часа. Если вы не оставляли отзыв — просто проигнорируйте письмо."),
      ].join("\n              "),
      ctaHref: "{{confirmUrl}}",
      ctaAlt: "Подтвердить отзыв",
      ctaKind: "action",
      afterCta: `<p style="margin:0;font-size:12px;color:#6a6578;word-break:break-all;max-width:420px">Или откройте ссылку:<br/><a href="{{confirmUrl}}" style="color:#6d28d9">{{confirmUrl}}</a></p>`,
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `Рады сообщить: обменник <strong>{{exchangerName}}</strong> официально добавлен в мониторинг <strong style="color:#6d28d9">{{siteName}}</strong>.`,
        ),
        emailHighlight(
          `Курсы и направления уже доступны пользователям. Надеемся на долгосрочное и успешное сотрудничество.`,
        ),
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">Данные для входа</h3>`,
        `<ul style="margin:0 0 16px;padding-left:18px;color:#17151f">
                <li>Логин: <code>{{ownerLogin}}</code></li>
                <li>Временный пароль: <code>{{tempPassword}}</code></li>
                <li>Кабинет: <a href="{{cabinetUrl}}" style="color:#6d28d9">{{cabinetUrl}}</a></li>
              </ul>`,
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">2FA</h3>`,
        `<p style="margin:0 0 8px">Секрет: <code>{{totpSecret}}</code></p>`,
        `<p style="margin:0 0 16px;font-size:13px;color:#6a6578;word-break:break-all">{{totpUri}}</p>`,
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">Баннер GapSnap</h3>`,
        p("{{bannerHint}}"),
      ].join("\n              "),
      ctaHref: "{{cabinetUrl}}",
      ctaAlt: "Открыть кабинет",
    }),
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "owner_access_remind",
    name: "Напоминание доступа в кабинет",
    description: "Логин и временный пароль по запросу владельца (email из обменника)",
    subject: "{{siteName}}: доступ в кабинет — «{{exchangerName}}»",
    text: `Вы запросили доступ к кабинету владельца на {{siteName}} для обменника «{{exchangerName}}».

Кабинет: {{cabinetUrl}}
Логин: {{ownerLogin}}
Временный пароль: {{tempPassword}}

{{totpText}}

Если вы не запрашивали доступ — проигнорируйте письмо.`,
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `Вы запросили доступ к кабинету владельца на <strong style="color:#6d28d9">{{siteName}}</strong> для обменника <strong>{{exchangerName}}</strong>.`,
        ),
        emailHighlight(
          `Ниже — данные для входа. Пароль временный: после входа рекомендуем сменить его при следующей возможности.`,
        ),
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">Данные для входа</h3>`,
        `<ul style="margin:0 0 16px;padding-left:18px;color:#17151f">
                <li>Логин: <code>{{ownerLogin}}</code></li>
                <li>Временный пароль: <code>{{tempPassword}}</code></li>
                <li>Кабинет: <a href="{{cabinetUrl}}" style="color:#6d28d9">{{cabinetUrl}}</a></li>
              </ul>`,
        "{{totpHtml}}",
        muted(
          "Если вы не запрашивали доступ — просто проигнорируйте это письмо.",
        ),
      ].join("\n              "),
      ctaHref: "{{cabinetUrl}}",
      ctaAlt: "Открыть кабинет",
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `На обменник <strong>{{exchangerName}}</strong> пришёл новый отзыв.`,
        ),
        emailHighlight(
          `Оценка: <strong>{{sentimentLabel}}</strong><br/>Заявка: <code>{{orderId}}</code>`,
        ),
        emailQuote("{{reviewText}}"),
        muted(
          `Страница обменника: <a href="{{publicUrl}}" style="color:#6d28d9">{{publicUrl}}</a>`,
        ),
      ].join("\n              "),
      ctaHref: "{{cabinetUrl}}",
      ctaAlt: "Ответить в кабинете",
      ctaKind: "action",
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `На сайте обменника <strong>{{exchangerName}}</strong> (<a href="{{website}}" style="color:#6d28d9">{{website}}</a>) мы не нашли кнопку GapSnap.`,
        ),
        emailHighlight(
          `По правилам мониторинга баннер обязателен. Скопируйте код в кабинете и разместите на сайте (обычно в футере).`,
          "warn",
        ),
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">HTML для вставки</h3>`,
        emailCodeBlock("{{bannerHtml}}"),
        muted(
          `Пропусков подряд: <strong>{{misses}}</strong>. Если баннер не появится, обменник могут снять с публикации на {{siteName}}.`,
        ),
      ].join("\n              "),
      ctaHref: "{{cabinetUrl}}",
      ctaAlt: "Открыть кабинет",
      ctaKind: "action",
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `Обменник <strong>{{exchangerName}}</strong> снят с публикации на <strong style="color:#6d28d9">{{siteName}}</strong>.`,
        ),
        emailHighlight(
          `Причина: на сайте <a href="{{website}}" style="color:#991b1b">{{website}}</a> не найдена кнопка GapSnap.`,
          "danger",
        ),
        p(
          `Разместите баннер и напишите в поддержку — мы проверим и восстановим карточку.`,
        ),
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">HTML для вставки</h3>`,
        emailCodeBlock("{{bannerHtml}}"),
        muted(
          `Если появятся вопросы — мы на связи и поможем вернуть карточку.`,
        ),
      ].join("\n              "),
      ctaHref: "{{cabinetUrl}}",
      ctaAlt: "Открыть кабинет",
      ctaKind: "action",
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `По вашему отзыву на <strong>{{exchangerName}}</strong> пришёл ответ (<strong>{{roleLabel}}</strong>).`,
        ),
        emailQuote("{{replyText}}"),
        muted(
          `Ссылка для ответа действует 14 дней. Страница: <a href="{{publicUrl}}" style="color:#6d28d9">{{publicUrl}}</a>`,
        ),
      ].join("\n              "),
      ctaHref: "{{replyUrl}}",
      ctaAlt: "Ответить на реакцию",
      ctaKind: "action",
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `Автор отзыва ответил по обменнику <strong>{{exchangerName}}</strong>.`,
        ),
        emailQuote("{{replyText}}"),
        muted(
          `Страница: <a href="{{publicUrl}}" style="color:#6d28d9">{{publicUrl}}</a>`,
        ),
      ].join("\n              "),
      ctaHref: "{{cabinetUrl}}",
      ctaAlt: "Ответить в кабинете",
      ctaKind: "action",
    }),
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
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте!"),
        p(
          `Вы отправили жалобу на обменник <strong>{{exchangerName}}</strong> на <strong style="color:#6d28d9">{{siteName}}</strong>.`,
        ),
        emailHighlight(
          `Чтобы жалоба была принята в работу, подтвердите email по кнопке ниже.`,
          "danger",
        ),
        muted("Ссылка действует 24 часа. Если вы не отправляли жалобу — проигнорируйте письмо."),
      ].join("\n              "),
      ctaHref: "{{confirmUrl}}",
      ctaAlt: "Подтвердить жалобу",
      ctaKind: "action",
      afterCta: `<p style="margin:0;font-size:12px;color:#6a6578;word-break:break-all;max-width:420px">Или откройте ссылку:<br/><a href="{{confirmUrl}}" style="color:#6d28d9">{{confirmUrl}}</a></p>`,
    }),
    enabled: true,
    updatedAt: NOW,
  },
  {
    id: "api_key_approved",
    name: "API-ключ одобрен",
    description: "Заявителю: выданный ключ доступа к /v2",
    subject: "{{siteName}}: ваш API-ключ",
    text: `Здравствуйте, {{clientName}}!

Ваша заявка на доступ к API {{siteName}} одобрена.

Ключ (сохраните — повторно не отправляется):
{{apiKey}}

Документация: {{docsUrl}}
Пример: {{exampleUrl}}

Лимит по умолчанию: 10 запросов в секунду.`,
    html: wrapEmailHtml({
      body: [
        p("Здравствуйте, <strong>{{clientName}}</strong>!"),
        p(
          `Ваша заявка на доступ к API <strong style="color:#6d28d9">{{siteName}}</strong> одобрена.`,
        ),
        `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">API-ключ</h3>`,
        muted("Сохраните ключ — повторно он не отправляется."),
        emailCodeBlock("{{apiKey}}"),
        muted(
          `Пример: <a href="{{exampleUrl}}" style="color:#6d28d9">{{exampleUrl}}</a><br/>Лимит по умолчанию: 10 запросов в секунду.`,
        ),
      ].join("\n              "),
      ctaHref: "{{docsUrl}}",
      ctaAlt: "Документация API",
      ctaKind: "action",
    }),
    enabled: true,
    updatedAt: NOW,
  },
];
