import { Router } from "express";
import { postChat } from "../controllers/chat.controller.js";
import { chatLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/chat", chatLimiter, postChat);

export default router;
