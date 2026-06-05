import cron from "node-cron";
import { digestCron } from "./digest/index.js";

const IST = "Asia/Kolkata";

export function registerAllCrons() {
  cron.schedule("0 9 * * *",() => {
   digestCron.sendDailyDigest();
  },
    { timezone: IST }
  );
  console.log("[cron] all schedules registered");
}
