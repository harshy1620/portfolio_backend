import { Resend } from "resend";

let client = null;

export function getEmailClient() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set in environment");
  }
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export function getRecipientEmail() {
  const email = process.env.DIGEST_RECIPIENT_EMAIL;
  if (!email) {
    throw new Error("DIGEST_RECIPIENT_EMAIL is not set in environment");
  }
  return email;
}

export const DEFAULT_SENDER = "onboarding@resend.dev";
