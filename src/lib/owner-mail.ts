import "server-only";

import { sendTemplatedEmail, siteBaseUrl } from "@/lib/email/service";
import { getSeoSettings } from "@/lib/store";

export function extractEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

export async function sendOwnerApprovedEmail(input: {
  to: string;
  exchangerName: string;
  ownerLogin: string;
  tempPassword: string;
  totpSecret: string;
  totpUri: string;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  await sendTemplatedEmail({
    templateId: "owner_approved",
    to: input.to,
    tag: "exchanger-approved",
    gate: "notifyOwnerExchangerApproved",
    vars: {
      exchangerName: input.exchangerName,
      ownerLogin: input.ownerLogin,
      tempPassword: input.tempPassword,
      totpSecret: input.totpSecret,
      totpUri: input.totpUri,
      cabinetUrl: `${base}/cabinet`,
      bannerHint:
        "После входа в кабинет скопируйте HTML-код маленького баннера GapSnap и разместите его на сайте обменника (в футере). Раз в сутки мы проверяем наличие кнопки.",
    },
  });
}

export async function sendOwnerAccessRemindEmail(input: {
  to: string;
  exchangerName: string;
  ownerLogin: string;
  tempPassword: string;
  /** Present when 2FA was just provisioned for the first time. */
  totpSecret?: string | null;
  totpUri?: string | null;
  totpAlreadyEnabled?: boolean;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);

  let totpText: string;
  let totpHtml: string;
  if (input.totpSecret && input.totpUri) {
    totpText = `2FA секрет: ${input.totpSecret}\notpauth: ${input.totpUri}\n\nПри входе: пароль + код из Authenticator.`;
    totpHtml = [
      `<h3 style="margin:0 0 8px;font-size:16px;color:#17151f">2FA</h3>`,
      `<p style="margin:0 0 8px">Секрет: <code>${input.totpSecret}</code></p>`,
      `<p style="margin:0 0 16px;font-size:13px;color:#6a6578;word-break:break-all">${input.totpUri}</p>`,
      `<p style="margin:0 0 16px">При входе: пароль + код из приложения-аутентификатора.</p>`,
    ].join("\n              ");
  } else if (input.totpAlreadyEnabled) {
    totpText =
      "У кабинета включена 2FA — при входе введите код из приложения-аутентификатора, как обычно.";
    totpHtml = `<p style="margin:0 0 16px">У кабинета включена 2FA — при входе введите код из приложения-аутентификатора, как обычно.</p>`;
  } else {
    totpText = "";
    totpHtml = "";
  }

  await sendTemplatedEmail({
    templateId: "owner_access_remind",
    to: input.to,
    tag: "owner-access-remind",
    vars: {
      exchangerName: input.exchangerName,
      ownerLogin: input.ownerLogin,
      tempPassword: input.tempPassword,
      cabinetUrl: `${base}/cabinet`,
      totpText,
      totpHtml,
    },
  });
}

export async function sendOwnerNewReviewEmail(input: {
  to: string;
  exchangerName: string;
  exchangerSlug: string;
  sentiment: "positive" | "negative";
  orderId: string;
  text: string;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  const preview =
    input.text.length > 280 ? `${input.text.slice(0, 277)}…` : input.text;
  await sendTemplatedEmail({
    templateId: "owner_new_review",
    to: input.to,
    tag: "review-owner-notify",
    gate: "notifyOwnerReviewApproved",
    vars: {
      exchangerName: input.exchangerName,
      exchangerSlug: input.exchangerSlug,
      sentimentLabel:
        input.sentiment === "positive" ? "положительный" : "отрицательный",
      orderId: input.orderId,
      reviewText: preview,
      cabinetUrl: `${base}/cabinet`,
      publicUrl: `${base}/exchangers/${input.exchangerSlug}`,
    },
  });
}

export async function sendOwnerBannerMissingEmail(input: {
  to: string;
  exchangerName: string;
  website: string;
  bannerHtml: string;
  misses: number;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  await sendTemplatedEmail({
    templateId: "owner_banner_missing",
    to: input.to,
    tag: "banner-owner-warn",
    vars: {
      exchangerName: input.exchangerName,
      website: input.website,
      cabinetUrl: `${base}/cabinet`,
      bannerHtml: input.bannerHtml,
      misses: String(input.misses),
    },
  });
}

export async function sendOwnerBannerUnpublishedEmail(input: {
  to: string;
  exchangerName: string;
  website: string;
  bannerHtml: string;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  await sendTemplatedEmail({
    templateId: "owner_banner_unpublished",
    to: input.to,
    tag: "banner-owner-unpublish",
    vars: {
      exchangerName: input.exchangerName,
      website: input.website,
      cabinetUrl: `${base}/cabinet`,
      bannerHtml: input.bannerHtml,
    },
  });
}

export async function sendReviewConfirmEmail(input: {
  to: string;
  exchangerName: string;
  orderId: string;
  confirmUrl: string;
}): Promise<void> {
  await sendTemplatedEmail({
    templateId: "review_confirm",
    to: input.to,
    tag: "review-confirm",
    gate: "notifyReviewConfirm",
    vars: {
      exchangerName: input.exchangerName,
      orderId: input.orderId,
      confirmUrl: input.confirmUrl,
    },
  });
}

export async function sendReviewerThreadNotify(input: {
  to: string;
  exchangerName: string;
  exchangerSlug: string;
  replyText: string;
  replyUrl: string;
  roleLabel: string;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  const preview =
    input.replyText.length > 280
      ? `${input.replyText.slice(0, 277)}…`
      : input.replyText;
  await sendTemplatedEmail({
    templateId: "review_owner_replied",
    to: input.to,
    tag: "review-thread-author",
    gate: "notifyReviewThreadAuthor",
    vars: {
      exchangerName: input.exchangerName,
      replyText: preview,
      replyUrl: input.replyUrl,
      publicUrl: `${base}/exchangers/${input.exchangerSlug}`,
      roleLabel: input.roleLabel,
    },
  });
}

export async function sendOwnerThreadNotify(input: {
  to: string;
  exchangerName: string;
  exchangerSlug: string;
  replyText: string;
}): Promise<void> {
  const seo = await getSeoSettings();
  const base = siteBaseUrl(seo.siteUrl);
  const preview =
    input.replyText.length > 280
      ? `${input.replyText.slice(0, 277)}…`
      : input.replyText;
  await sendTemplatedEmail({
    templateId: "review_author_replied",
    to: input.to,
    tag: "review-thread-owner",
    gate: "notifyReviewThreadOwner",
    vars: {
      exchangerName: input.exchangerName,
      replyText: preview,
      cabinetUrl: `${base}/cabinet`,
      publicUrl: `${base}/exchangers/${input.exchangerSlug}`,
    },
  });
}

export async function sendComplaintConfirmEmail(input: {
  to: string;
  exchangerName: string;
  confirmUrl: string;
}): Promise<void> {
  await sendTemplatedEmail({
    templateId: "complaint_confirm",
    to: input.to,
    tag: "complaint-confirm",
    gate: "notifyComplaintConfirm",
    vars: {
      exchangerName: input.exchangerName,
      confirmUrl: input.confirmUrl,
    },
  });
}
