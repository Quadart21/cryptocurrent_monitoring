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
