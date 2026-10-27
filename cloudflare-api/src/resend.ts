export interface ResendEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
}

export interface TransactionalEmail {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured" | "invalid_message" | "provider_error" | "timeout" };

const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

export async function sendTransactionalEmail(
  env: ResendEnv,
  message: TransactionalEmail,
): Promise<EmailResult> {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) return { ok: false, reason: "not_configured" };

  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (
    !validEmail(from) ||
    recipients.length < 1 ||
    recipients.length > 20 ||
    recipients.some((email) => typeof email !== "string" || !validEmail(email)) ||
    typeof message.subject !== "string" ||
    message.subject.trim().length < 1 ||
    message.subject.length > 200 ||
    (!message.html && !message.text) ||
    (message.html !== undefined && message.html.length > 100_000) ||
    (message.text !== undefined && message.text.length > 100_000) ||
    (env.RESEND_REPLY_TO && !validEmail(env.RESEND_REPLY_TO.trim()))
  ) {
    return { ok: false, reason: "invalid_message" };
  }

  const payload: Record<string, unknown> = {
    from,
    to: recipients,
    subject: message.subject.trim(),
  };
  if (message.html !== undefined) payload.html = message.html;
  if (message.text !== undefined) payload.text = message.text;
  if (env.RESEND_REPLY_TO?.trim()) payload.reply_to = env.RESEND_REPLY_TO.trim();

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "provider_error" };
  }

  if (!response.ok) return { ok: false, reason: "provider_error" };
  try {
    const result = await response.json() as { id?: unknown };
    return typeof result.id === "string" && result.id.length > 0
      ? { ok: true, id: result.id }
      : { ok: false, reason: "provider_error" };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}
