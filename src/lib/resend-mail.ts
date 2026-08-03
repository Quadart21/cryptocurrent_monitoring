import "server-only";

import { Resend } from "resend";

export type ResendSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  name?: string;
  reply?: string;
  tag?: string;
  /** RFC Message-ID of the message we reply to */
  inReplyTo?: string;
  references?: string;
};

function apiKey(): string {
  const key =
    process.env.RESEND_API_KEY?.trim() ||
    process.env.SMTPBZ_API_KEY?.trim() || // temporary alias during migration
    "";
  if (!key) throw new Error("RESEND_API_KEY не задан");
  return key;
}

export function getResendClient(): Resend {
  return new Resend(apiKey());
}

export function resendConfigured(): boolean {
  return Boolean(
    (process.env.RESEND_API_KEY?.trim() || process.env.SMTPBZ_API_KEY?.trim()) &&
      (process.env.RESEND_FROM?.trim() ||
        process.env.SMTPBZ_FROM?.trim()),
  );
}

export function resendConfigStatus() {
  return {
    provider: "resend" as const,
    hasApiKey: Boolean(
      process.env.RESEND_API_KEY?.trim() || process.env.SMTPBZ_API_KEY?.trim(),
    ),
    hasFromEnv: Boolean(
      process.env.RESEND_FROM?.trim() || process.env.SMTPBZ_FROM?.trim(),
    ),
    fromEnv:
      process.env.RESEND_FROM?.trim() ||
      process.env.SMTPBZ_FROM?.trim() ||
      null,
    fromNameEnv:
      process.env.RESEND_FROM_NAME?.trim() ||
      process.env.SMTPBZ_FROM_NAME?.trim() ||
      null,
    hasWebhookSecret: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
  };
}

function formatFrom(email: string, name?: string): string {
  const n = (name ?? "").trim();
  if (!n) return email;
  // Escape quotes in display name
  const safe = n.replace(/"/g, '\\"');
  return `"${safe}" <${email}>`;
}

export async function sendResendEmail(
  input: ResendSendInput,
): Promise<{ id: string; raw: string }> {
  const fromEmail = (
    input.from ||
    process.env.RESEND_FROM?.trim() ||
    process.env.SMTPBZ_FROM?.trim() ||
    ""
  ).trim();
  const fromName =
    (input.name ||
      process.env.RESEND_FROM_NAME?.trim() ||
      process.env.SMTPBZ_FROM_NAME?.trim() ||
      "GapSnap").trim();
  if (!fromEmail) throw new Error("RESEND_FROM / fromEmail не задан");

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers.References = input.references;

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: formatFrom(fromEmail, fromName),
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.reply || undefined,
    tags: input.tag
      ? [{ name: "category", value: input.tag.slice(0, 50) }]
      : undefined,
    headers: Object.keys(headers).length ? headers : undefined,
  });

  if (error) {
    throw new Error(`Resend ошибка: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend: пустой ответ при отправке");
  }

  return {
    id: data.id,
    raw: JSON.stringify(data),
  };
}
