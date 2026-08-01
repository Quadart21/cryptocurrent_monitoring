export type EmailTemplateId =
  | "review_confirm"
  | "owner_approved"
  | "owner_access_remind"
  | "owner_new_review"
  | "owner_banner_missing"
  | "owner_banner_unpublished"
  | "review_owner_replied"
  | "review_author_replied"
  | "complaint_confirm"
  | "api_key_approved";

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
  notifyReviewThreadAuthor: boolean;
  notifyReviewThreadOwner: boolean;
  notifyComplaintConfirm: boolean;
  notifyApiKeyApproved: boolean;
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
    "siteUrl",
    "exchangerName",
    "confirmUrl",
    "orderId",
  ],
  owner_approved: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "ownerLogin",
    "tempPassword",
    "cabinetUrl",
    "totpSecret",
    "totpUri",
  ],
  owner_access_remind: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "ownerLogin",
    "tempPassword",
    "cabinetUrl",
    "totpText",
    "totpHtml",
  ],
  owner_new_review: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "exchangerSlug",
    "sentimentLabel",
    "orderId",
    "reviewText",
    "cabinetUrl",
    "publicUrl",
  ],
  owner_banner_missing: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "website",
    "cabinetUrl",
    "bannerHtml",
    "misses",
  ],
  owner_banner_unpublished: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "website",
    "cabinetUrl",
    "bannerHtml",
  ],
  review_owner_replied: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "replyText",
    "replyUrl",
    "publicUrl",
    "roleLabel",
  ],
  review_author_replied: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "replyText",
    "cabinetUrl",
    "publicUrl",
  ],
  complaint_confirm: [
    "siteName",
    "siteUrl",
    "exchangerName",
    "confirmUrl",
  ],
  api_key_approved: [
    "siteName",
    "siteUrl",
    "clientName",
    "apiKey",
    "docsUrl",
    "exampleUrl",
  ],
};
