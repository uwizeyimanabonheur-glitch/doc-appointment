// Notification helpers: email via Web3Forms, SMS via ClickSend.
//
// Both functions degrade gracefully: if the relevant provider keys are
// missing (e.g. you haven't created them yet), the message is logged to the
// server console instead of throwing, so the whole app keeps working.

type Channel = "email" | "sms";

export interface NotifyResult {
  channel: Channel;
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return value.startsWith("your-") || value.includes("replace");
}

/**
 * Send an email notification through Web3Forms.
 * https://docs.web3forms.com/
 */
export async function sendEmail(params: {
  to?: string | null;
  subject: string;
  message: string;
}): Promise<NotifyResult> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;

  if (isPlaceholder(accessKey)) {
    console.info(
      `[email:skipped] to=${params.to ?? "-"} subject="${params.subject}"\n${params.message}`,
    );
    return { channel: "email", ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: accessKey,
        subject: params.subject,
        // Web3Forms delivers to the inbox configured on the access key.
        // We include the intended recipient in the body + reply-to field.
        from_name: "Chronic Care Scheduler",
        email: params.to ?? undefined,
        replyto: params.to ?? undefined,
        recipient: params.to ?? undefined,
        message: params.message,
      }),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (!res.ok || !data.success) {
      return { channel: "email", ok: false, error: data.message || `HTTP ${res.status}` };
    }
    return { channel: "email", ok: true };
  } catch (err) {
    return { channel: "email", ok: false, error: (err as Error).message };
  }
}

/**
 * Send an SMS notification through ClickSend.
 * https://developers.clicksend.com/docs/rest/v3/#send-sms
 */
export async function sendSms(params: {
  to?: string | null;
  message: string;
}): Promise<NotifyResult> {
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;

  if (!params.to || isPlaceholder(username) || isPlaceholder(apiKey)) {
    console.info(`[sms:skipped] to=${params.to ?? "-"}\n${params.message}`);
    return { channel: "sms", ok: false, skipped: true };
  }

  try {
    const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            source: "nextjs",
            from: process.env.CLICKSEND_SENDER || undefined,
            to: params.to,
            body: params.message,
          },
        ],
      }),
    });
    const data = (await res.json()) as {
      response_code?: string;
      data?: { messages?: Array<{ status?: string }> };
    };
    if (!res.ok || data.response_code !== "SUCCESS") {
      return { channel: "sms", ok: false, error: data.response_code || `HTTP ${res.status}` };
    }
    return { channel: "sms", ok: true };
  } catch (err) {
    return { channel: "sms", ok: false, error: (err as Error).message };
  }
}

/** Send both an email and an SMS, ignoring individual failures. */
export async function notify(params: {
  email?: string | null;
  phone?: string | null;
  subject: string;
  message: string;
}): Promise<NotifyResult[]> {
  return Promise.all([
    sendEmail({ to: params.email, subject: params.subject, message: params.message }),
    sendSms({ to: params.phone, message: params.message }),
  ]);
}
