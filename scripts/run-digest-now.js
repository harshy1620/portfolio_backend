import "dotenv/config";
import mongoose from "mongoose";
import { runDailyDigest } from "../src/services/digest.service.js";

async function main() {
  console.log("[run-digest-now] connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const result = await runDailyDigest();
    console.log("[run-digest-now] result:", JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("[run-digest-now] crashed:", err);
  process.exit(1);
});
