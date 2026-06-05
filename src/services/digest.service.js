import { Conversation } from "../models/Conversation.js";
import { createPresignedDownloadUrl } from "../utils/signedUrl.js";
import {
  getEmailClient,
  getRecipientEmail,
  DEFAULT_SENDER,
} from "../config/email.js";
import { renderDigestEmail } from "../templates/digestEmail.js";

async function findConversationsToDigest() {
  return Conversation.find({
    $expr: {
      $or: [
        { $eq: ["$digestSentAt", null] },
        { $gt: ["$updatedAt", "$digestSentAt"] },
      ],
    },
  })
    .sort({ updatedAt: 1 })
    .lean();
}

async function attachSignedUrls(conversations) {
  return Promise.all(
    conversations.map(async (conv) => {
      const uploads = await Promise.all(
        (conv.resumeUploads || []).map(async (u) => ({
          ...u,
          signedUrl: await createPresignedDownloadUrl(u.s3Key),
        }))
      );
      return { ...conv, resumeUploads: uploads };
    })
  );
}

async function markDigested(conversationIds) {
  const now = new Date();
  await Conversation.updateMany(
    { _id: { $in: conversationIds } },
    { $set: { digestSentAt: now } },
    { timestamps: false }
  );
  return now;
}

export async function runDailyDigest() {
  const conversations = await findConversationsToDigest();

  if (conversations.length === 0) {
    console.log("[digest] nothing new to send");
    return { sent: false, reason: "no new activity" };
  }

  console.log(`[digest] found ${conversations.length} conversation(s) to include`);

  const enriched = await attachSignedUrls(conversations);
  const { subject, html } = renderDigestEmail({ conversations: enriched });

  const resend = getEmailClient();
  const recipient = getRecipientEmail();

  const { data, error } = await resend.emails.send({
    from: DEFAULT_SENDER,
    to: recipient,
    subject,
    html,
  });

  if (error) {
    console.error("[digest] email send failed:", error);
    throw new Error(`Email send failed: ${error.message || JSON.stringify(error)}`);
  }

  const digestedAt = await markDigested(conversations.map((c) => c._id));

  console.log(`[digest] sent email ${data?.id} covering ${conversations.length} conversation(s)`);
  return {
    sent: true,
    count: conversations.length,
    emailId: data?.id,
    digestedAt,
  };
}
