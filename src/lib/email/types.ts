export type EmailTemplateId =
  | "review_confirm"
  | "owner_approved"
  | "owner_new_review";

export type EmailContactSource = "exchanger" | "review" | "manual";

export type EmailContact = {
  email: string;
  sources: EmailContactSource[];
  label: string;
  exchangerIds: string[];
  unsubscribed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastSegment = "all" | "exchangers" | "reviewers";

export type EmailSettings = {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  notifyReviewConfirm: boolean;
  notifyOwnerExchangerApproved: boolean;
  notifyOwnerReviewApproved: boolean;
  updatedAt: string;
};

export type EmailTemplate = {
  id: EmailTemplateId | string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  enabled: boolean;
  updatedAt: string;
};

export type EmailLogRow = {
  id: string;
  createdAt: string;
  toAddress: string;
  subject: string;
  tag: string;
  templateId: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  providerRaw: string | null;
};

export const EMAIL_TEMPLATE_VARS: Record<string, string[]> = {
  review_confirm: [
    "siteName",
    "exchangerName",
    "confirmUrl",
    "orderId",
  ],
  owner_approved: [
    "siteName",
    "exchangerName",
    "ownerLogin",
    "tempPassword",
    "cabinetUrl",
    "totpSecret",
    "totpUri",
  ],
  owner_new_review: [
    "siteName",
    "exchangerName",
    "exchangerSlug",
    "sentimentLabel",
    "orderId",
    "reviewText",
    "cabinetUrl",
    "publicUrl",
  ],
};
