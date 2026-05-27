import { Router } from "express";
import { resumeUpload } from "../middleware/upload.middleware.js";
import { postUploadResume } from "../controllers/upload.controller.js";

const router = Router();

router.post("/upload-resume", resumeUpload.single("resume"), postUploadResume);

export default router;
