import {
  uploadResumeToS3,
  attachResumeToConversation,
} from "../services/upload.service.js";

const MAX_SESSION_ID_LENGTH = 100;

function validateSessionId(sessionId) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return "sessionId must be a non-empty string";
  }
  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    return `sessionId exceeds ${MAX_SESSION_ID_LENGTH} characters`;
  }
  return null;
}

export async function postUploadResume(req, res, next) {
  try {
    const { sessionId } = req.body ?? {};

    const sessionError = validateSessionId(sessionId);
    if (sessionError) {
      return res.status(400).json({ error: sessionError });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Resume file is required (form field name: 'resume')",
      });
    }

    const uploadInfo = await uploadResumeToS3({ sessionId, file: req.file });
    const conversation = await attachResumeToConversation(sessionId, uploadInfo);

    res.json({
      ok: true,
      upload: {
        s3Key: uploadInfo.s3Key,
        originalName: uploadInfo.originalName,
        size: uploadInfo.size,
        mimeType: uploadInfo.mimeType,
      },
      conversationId: conversation._id,
    });
  } catch (err) {
    next(err);
  }
}
