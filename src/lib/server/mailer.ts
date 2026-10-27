import { Resend } from "resend";

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
}

export interface Mailer {
  send(message: { to: string[]; subject: string; html: string; text: string; replyTo?: string[]; attachments: MailAttachment[] }): Promise<{ id: string }>;
}

export class MailerNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set");
    this.name = "MailerNotConfiguredError";
  }
}

export function getMailConfig() {
  const recipients = (process.env.DECLARATION_RECIPIENTS ?? "arnaudlehalle@gmail.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    apiKey: process.env.RESEND_API_KEY,
    // onboarding@resend.dev works without a verified domain, but only towards
    // the e-mail of the Resend account owner. Set MAIL_FROM once a domain is verified.
    from: process.env.MAIL_FROM ?? "SONIQ RIGHTS <onboarding@resend.dev>",
    recipients,
  };
}

export function createResendMailer(): Mailer {
  const { apiKey, from } = getMailConfig();
  if (!apiKey) throw new MailerNotConfiguredError();
  const resend = new Resend(apiKey);
  return {
    async send(message) {
      const { data, error } = await resend.emails.send({
        from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
      });
      if (error || !data) throw new Error(`Resend: ${error?.message ?? "unknown error"}`);
      return { id: data.id };
    },
  };
}
