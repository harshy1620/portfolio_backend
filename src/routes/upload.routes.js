import { Router } from "express";
import { resumeUpload } from "../middleware/upload.middleware.js";
import { uploadLimiter } from "../middleware/rateLimit.middleware.js";
import { postUploadResume } from "../controllers/upload.controller.js";

const router = Router();

router.post(
  "/upload-resume",uploadLimiter,resumeUpload.single("resume"),postUploadResume
);

export default router;
