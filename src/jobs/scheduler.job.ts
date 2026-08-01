import cron from "node-cron";

import { cleanupTokens } from "./cleanupTokens.job.js";

export const startJobScheduler = (): void => {
    /*
     * Every day at 02:00
     */
    cron.schedule("0 2 * * *", async () => {
        try {
            console.log("[Cron] Running token cleanup...");

            await cleanupTokens();

            console.log("[Cron] Token cleanup completed");
        } catch (error) {
            console.error(
                "[Cron] Token cleanup failed:",
                error
            );
        }
    });

  

    console.log("Background job scheduler started");
};