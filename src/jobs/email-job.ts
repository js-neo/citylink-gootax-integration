// src/jobs/email-job.ts

import { checkEmails } from "../modules/email-parser/index.js";
import { logger } from "../utils/logger.js";

export function initEmailJobs() {
    let isRunning = false;
    const intervalMs = 300_000;

    async function runCheck() {
        if (isRunning) return;
        isRunning = true;

        try {
            await checkEmails();
            logger.info('Проверка почты успешно завершена');
        } catch (error) {
            logger.error('Ошибка проверки почты:', error);
        } finally {
            isRunning = false;
        }
    }

    runCheck();

    const interval = setInterval(runCheck, intervalMs);

    return () => {
        clearInterval(interval);
        logger.info('Проверка почты остановлена');
    };
}