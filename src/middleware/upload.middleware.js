import multer from "multer";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error(
      `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOC, DOCX.`
    );
    err.status = 400;
    cb(err, false);
    return;
  }
  cb(null, true);
}

export const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
