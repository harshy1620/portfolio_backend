import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { connectDB } from "./config/db.js";

const app = express();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    env: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", chatRoutes);
app.use("/api", uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error("[error]", err);

  if (err.name === "MulterError") {
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
      code: err.code,
    });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT} (${NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error("[fatal] failed to start server:", err);
  process.exit(1);
});
