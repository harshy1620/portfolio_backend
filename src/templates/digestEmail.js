function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateTime(date) {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderMessage(msg) {
  const isUser = msg.role === "user";
  const roleLabel = isUser ? "VISITOR" : "AI (HARSH)";
  const roleColor = isUser ? "#0366d6" : "#6f42c1";
  const bgColor = isUser ? "#f1f8ff" : "#f5f0ff";

  return `
    <div style="margin: 12px 0; padding: 10px 12px; background: ${bgColor}; border-left: 3px solid ${roleColor}; border-radius: 4px;">
      <div style="font-size: 11px; font-weight: 600; color: ${roleColor}; margin-bottom: 4px;">${roleLabel}</div>
      <div style="font-size: 14px; color: #24292e; white-space: pre-wrap;">${escapeHtml(msg.content)}</div>
    </div>
  `;
}

function renderUpload(upload) {
  return `
    <div style="margin: 12px 0; padding: 12px; background: #fff8e6; border: 1px solid #f5d97a; border-radius: 6px;">
      <div style="font-size: 14px; font-weight: 600; color: #24292e;">
        📎 ${escapeHtml(upload.originalName)}
      </div>
      <div style="font-size: 12px; color: #586069; margin-top: 4px;">
        ${formatSize(upload.size)} &middot; ${escapeHtml(upload.mimeType)} &middot; uploaded ${formatDateTime(upload.uploadedAt)}
      </div>
      <div style="margin-top: 8px;">
        <a href="${upload.signedUrl}" style="display: inline-block; background: #0366d6; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 13px;">
          Download (expires in 7 days)
        </a>
      </div>
    </div>
  `;
}

function renderConversation(conv, index) {
  const messagesHtml = (conv.messages || []).map(renderMessage).join("");
  const uploadsHtml = (conv.resumeUploads || []).map(renderUpload).join("");
  const visitorInfo = conv.visitor?.ip
    ? `<div style="font-size: 12px; color: #586069; margin-top: 4px;">Visitor IP: ${escapeHtml(conv.visitor.ip)}</div>`
    : "";

  return `
    <div style="border: 1px solid #e1e4e8; border-radius: 8px; padding: 16px; margin-bottom: 20px; background: white;">
      <div style="border-bottom: 1px solid #e1e4e8; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-size: 15px; font-weight: 600; color: #24292e;">
          Conversation #${index + 1}
        </div>
        <div style="font-size: 12px; color: #586069; margin-top: 4px;">
          Last activity: ${formatDateTime(conv.updatedAt)} &middot; ${(conv.messages || []).length} messages &middot; ${(conv.resumeUploads || []).length} uploads
        </div>
        ${visitorInfo}
      </div>
      ${messagesHtml || '<div style="color: #586069; font-style: italic;">No chat messages yet.</div>'}
      ${uploadsHtml}
    </div>
  `;
}

export function renderDigestEmail({ conversations }) {
  const totalUploads = conversations.reduce(
    (sum, c) => sum + ((c.resumeUploads || []).length),
    0
  );
  const totalMessages = conversations.reduce(
    (sum, c) => sum + ((c.messages || []).length),
    0
  );
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject = `Portfolio AI — ${todayLabel} (${conversations.length} conv, ${totalUploads} upload${totalUploads === 1 ? "" : "s"})`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f8fa; padding: 20px; margin: 0; color: #24292e;">
  <div style="max-width: 640px; margin: 0 auto;">
    <div style="background: white; border-radius: 10px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="margin: 0 0 4px 0; color: #24292e;">Portfolio AI — Daily Digest</h2>
      <div style="color: #586069; font-size: 14px;">${todayLabel}</div>

      <div style="background: #f1f8ff; border: 1px solid #c8e1ff; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
        <strong>${conversations.length}</strong> conversation${conversations.length === 1 ? "" : "s"} &middot;
        <strong>${totalMessages}</strong> message${totalMessages === 1 ? "" : "s"} &middot;
        <strong>${totalUploads}</strong> resume upload${totalUploads === 1 ? "" : "s"}
      </div>

      ${conversations.map(renderConversation).join("")}

      <div style="text-align: center; color: #586069; font-size: 11px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e1e4e8;">
        Sent automatically by your portfolio backend.<br>
        Download links expire 7 days from email send.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}
