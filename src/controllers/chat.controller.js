import { handleChat } from "../services/chat.service.js";

const MAX_MESSAGES = 30;
const MAX_CONTENT_LENGTH = 2000;
const MAX_SESSION_ID_LENGTH = 100;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

function validateSessionId(sessionId) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return "sessionId must be a non-empty string";
  }
  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    return `sessionId exceeds ${MAX_SESSION_ID_LENGTH} characters`;
  }
  return null;
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return "messages must be an array";
  }
  if (messages.length === 0) {
    return "messages must contain at least one message";
  }
  if (messages.length > MAX_MESSAGES) {
    return `messages cannot exceed ${MAX_MESSAGES} entries`;
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== "object") {
      return `messages[${i}] must be an object`;
    }
    if (!ALLOWED_ROLES.has(m.role)) {
      return `messages[${i}].role must be 'user' or 'assistant'`;
    }
    if (typeof m.content !== "string" || !m.content.trim()) {
      return `messages[${i}].content must be a non-empty string`;
    }
    if (m.content.length > MAX_CONTENT_LENGTH) {
      return `messages[${i}].content exceeds ${MAX_CONTENT_LENGTH} characters`;
    }
  }
  if (messages[messages.length - 1].role !== "user") {
    return "the last message must be from the user";
  }
  return null;
}

export async function postChat(req, res, next) {
  try {
    const { messages, sessionId } = req.body ?? {};

    const sessionError = validateSessionId(sessionId);
    if (sessionError) {
      return res.status(400).json({ error: sessionError });
    }

    const messagesError = validateMessages(messages);
    if (messagesError) {
      return res.status(400).json({ error: messagesError });
    }

    const visitor = {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };

    const { reply, usage, model, conversationId } = await handleChat({
      sessionId,
      messages,
      visitor,
    });

    res.json({
      reply,
      meta: { model, usage, conversationId },
    });
  } catch (err) {
    next(err);
  }
}
