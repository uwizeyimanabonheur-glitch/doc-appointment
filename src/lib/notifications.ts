// Notification helpers: email via google app, SMS via ClickSend.
//
// Both functions degrade gracefully: if the relevant provider keys are
// missing (e.g. you haven't created them yet), the message is logged to the
// server console instead of throwing, so the whole app keeps working.

// Lazy-import `nodemailer` inside `sendEmail` so a missing/invalid package
// doesn't cause module-load failures that could break unrelated routes.

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
  html?: string | null;
}): Promise<NotifyResult> {
  // Use Google App (Gmail SMTP) via nodemailer. Prefer an app password or
  // service account SMTP configuration. Required env vars:
  // - GMAIL_USER (email address)
  // - GMAIL_APP_PASSWORD (app password) OR SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  // Allow custom SMTP settings to support non-Gmail SMTP providers.
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const missing = !gmailUser && !smtpUser;
  const missingAuth = !gmailAppPassword && !smtpPass;

  if (missing || missingAuth) {
    console.info(`[email:skipped] to=${params.to ?? "-"} subject="${params.subject}"\n${params.message}`);
    return { channel: "email", ok: false, skipped: true };
  }

  // If email is dummy (contains example.com), skip sending and log to console.
  if (params.to && params.to.includes("example.com")) {
    console.info(`[email:skipped] to=${params.to} subject="${params.subject}"\n${params.message}`);
    return { channel: "email", ok: false, skipped: true };
  }

  try {
    // Build transport config: prefer explicit SMTP config, otherwise Gmail.
    let transportOptions: any;
    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      transportOptions = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: { user: smtpUser, pass: smtpPass },
      };
    } else {
      // Gmail SMTP using app password
      transportOptions = {
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailAppPassword },
      };
    }

    // Lazy-import nodemailer so missing packages or platform-specific
    // failures don't throw during module load and break unrelated routes.
    let nodemailer: typeof import('nodemailer');
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nodemailer = await import('nodemailer');
    } catch (impErr) {
      console.error('Failed to import nodemailer:', (impErr as Error).message);
      return { channel: 'email', ok: false, skipped: true, error: 'nodemailer unavailable' };
    }

    const transporter = nodemailer.createTransport(transportOptions);

    // Verify transport (will throw on invalid credentials in many cases)
    try {
      await transporter.verify();
    } catch (verifyErr) {
      console.error('Email transport verify failed:', (verifyErr as Error).message);
      return { channel: 'email', ok: false, error: (verifyErr as Error).message };
    }

    const fromAddress = process.env.EMAIL_FROM || gmailUser || smtpUser;

    // Prefer explicit HTML if provided; otherwise convert plain text to basic HTML.
    const htmlBody = params.html ?? params.message.replace(/\n/g, '<br/>');
    // Create a simple plain-text fallback by stripping tags if html provided,
    // otherwise use the original plain message.
    const plainText = params.html
      ? params.html.replace(/<[^>]+>/g, '').replace(/&nbsp;|&amp;/g, ' ')
      : params.message;

    const mailOptions = {
      from: fromAddress,
      to: params.to ?? undefined,
      subject: params.subject,
      text: plainText,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info);
    return { channel: 'email', ok: true };
  } catch (err) {
    return { channel: 'email', ok: false, error: (err as Error).message };
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
    const dummyPhoneNumbers = ["0788888888",
      "0788888889",
      "0788888891",
      "0788888890",
      "0788888890"
    ]
    const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
    // Avoid sending sms to dummy numbers during development/testing. Just log and return success.
    if (dummyPhoneNumbers.includes(params.to!)) {
      console.log("[sms:skipped] to=dummy number, not sending SMS during development/testing\n", params.message);
      return { channel: "sms", ok: true }; //dummyPhoneNumbers params.to 
    }

    const clicksendBody = JSON.stringify({
      messages: [
        {
          source: "nextjs",
          from: process.env.CLICKSEND_SENDER || undefined,
          to: params.to,
          body: params.message,
        },
      ],
    })
    console.log('ClickSend request body:', clicksendBody);

    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: clicksendBody
    });
    console.log("ClickSend response: ", await res.text())
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
  html?: string | null;
}): Promise<NotifyResult[]> {
  return Promise.all([
    sendEmail({ to: params.email, subject: params.subject, message: params.message, html: params.html ?? null }),
    // sendSms({ to: params.phone, message: params.message }),
  ]);
}
