import "dotenv/config";
import {
  getEmailClient,
  getRecipientEmail,
  DEFAULT_SENDER,
} from "../src/config/email.js";

async function main() {
  const resend = getEmailClient();
  const recipient = getRecipientEmail();

  console.log(`[test-email] sending from ${DEFAULT_SENDER} to ${recipient}...`);

  const { data, error } = await resend.emails.send({
    from: DEFAULT_SENDER,
    to: recipient,
    subject: "Portfolio AI — Test email (Step 5a)",
    html: `
      <h2>Hello from your portfolio backend</h2>
      <p>If you're reading this in your inbox, Resend is wired up correctly.</p>
      <p>Next steps:</p>
      <ul>
        <li>Step 5b — pre-signed S3 URLs</li>
        <li>Step 5c — the digest service</li>
        <li>Step 5d — wire it to a 9 AM cron</li>
      </ul>
      <p style="color:#888;font-size:12px;">Sent at ${new Date().toISOString()}</p>
    `,
  });

  if (error) {
    console.error("[test-email] FAILED:", error);
    process.exit(1);
  }

  console.log("[test-email] sent successfully. Resend response:");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("[test-email] crashed:", err);
  process.exit(1);
});
