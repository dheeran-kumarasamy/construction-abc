type SmsPayload = {
  to?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
};

type SmsResult = {
  sent: boolean;
  provider: string;
  reason?: string;
};

export async function sendSmsNotification(payload: SmsPayload): Promise<SmsResult> {
  const provider = String(process.env.SMS_PROVIDER || "webhook").trim().toLowerCase();
  const to = String(payload.to || "").trim();

  if (!to) {
    return { sent: false, provider, reason: "missing_recipient_phone" };
  }

  const webhookUrl = String(process.env.SMS_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    return { sent: false, provider, reason: "sms_webhook_not_configured" };
  }

  const token = String(process.env.SMS_WEBHOOK_TOKEN || "").trim();

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        to,
        message: payload.message,
        metadata: payload.metadata || {},
      }),
    });

    if (!response.ok) {
      return {
        sent: false,
        provider,
        reason: `sms_provider_error_${response.status}`,
      };
    }

    return { sent: true, provider };
  } catch {
    return { sent: false, provider, reason: "sms_provider_network_error" };
  }
}
