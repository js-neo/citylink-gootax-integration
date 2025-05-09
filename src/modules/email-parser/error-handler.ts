// src/modules/email-parser/error-handler.ts
import nodemailer from 'nodemailer';
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";

const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
    }
});

export async function handleEmailError(
    originalEmail: string | undefined,
    error: unknown
) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Ошибка при обработке электронной почты:', errorMessage);

    if (!originalEmail) return;

    try {
        await transporter.sendMail({
            to: process.env.SUPPORT_EMAIL || 'support@example.com',
            subject: 'Ошибка обработки письма с заказом',
            text: `Произошла ошибка при обработке письма:\n\n` +
                `Ошибка: ${errorMessage}\n\n` +
                `Первые 500 символов письма:\n` +
                originalEmail.substring(0, 500)
        });
    } catch (sendError) {
        logger.error('Ошибка отправки письма:', sendError);
    }
}