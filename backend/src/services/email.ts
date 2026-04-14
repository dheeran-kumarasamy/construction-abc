import nodemailer from "nodemailer";

type InviteEmailInput = {
  to: string;
  inviteLink: string;
  inviteeRole: "builder" | "architect";
  invitedByEmail?: string | null;
};

let transporter: nodemailer.Transporter | null = null;

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  // Generic SMTP envs (preferred), with Brevo-specific fallbacks for convenience.
  const host = process.env.SMTP_HOST || process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.SMTP_PORT || process.env.BREVO_SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: parseBool(process.env.SMTP_SECURE, port === 465),
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    // SMTP config is optional in local/dev. Caller can still use invite link fallback.
    return false;
  }

  const appName = process.env.APP_NAME || "Construction App";
  const from =
    process.env.SMTP_FROM ||
    process.env.BREVO_SMTP_FROM ||
    process.env.SMTP_USER ||
    process.env.BREVO_SMTP_LOGIN ||
    "no-reply@example.com";
  const roleLabel = input.inviteeRole === "builder" ? "Builder" : "Architect Team";
  const invitedBy = input.invitedByEmail ? ` from ${input.invitedByEmail}` : "";

  const subject = `${appName}: ${roleLabel} invite`;
  const text = [
    `You have been invited as ${roleLabel}${invitedBy}.`,
    "",
    "Use the link below to sign up and accept your invite:",
    input.inviteLink,
    "",
    "This invite expires in 7 days.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">${appName} Invite</h2>
      <p>You have been invited as <strong>${roleLabel}</strong>${invitedBy}.</p>
      <p>Click the button below to sign up and accept your invite:</p>
      <p style="margin: 20px 0;">
        <a href="${input.inviteLink}" style="background:#0f766e;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invite</a>
      </p>
      <p>If the button doesn't work, use this link:</p>
      <p><a href="${input.inviteLink}">${input.inviteLink}</a></p>
      <p style="color:#64748b;">This invite expires in 7 days.</p>
    </div>
  `;

  await tx.sendMail({
    from,
    to: input.to,
    subject,
    text,
    html,
  });

  return true;
}
