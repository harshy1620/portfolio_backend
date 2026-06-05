import { runDailyDigest } from "../../services/digest.service.js";

export const digestCron = {
  async sendDailyDigest() {
    const startedAt = new Date();
    console.log(`[cron:digest] triggered at ${startedAt.toISOString()}`);
    try {
      const result = await runDailyDigest();
      console.log("[cron:digest] finished:", JSON.stringify(result));
    } catch (err) {
      console.error("[cron:digest] failed:", err);
    }
  },
};
