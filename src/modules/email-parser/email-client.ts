// src/modules/email-parser/email-client.ts

import { ImapFlow } from 'imapflow';
import { parseEmail } from './email-parser.js';
import { OrderProcessor } from "../../services/order-processor.js";
import { logger } from "../../utils/logger.js";
import { handleEmailError } from './error-handler.js';

const orderProcessor = OrderProcessor.getInstance();

export async function createEmailClient() {
    return new ImapFlow({
        host: process.env.EMAIL_HOST!,
        port: 993,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER!,
            pass: process.env.EMAIL_PASSWORD!
        },
        logger: {
            debug: () => {},
            info: (msg) => logger.info(`IMAP: ${msg}`),
            warn: (msg) => logger.warn(`IMAP: ${msg}`),
            error: (msg) => logger.error(`IMAP: ${msg}`)
        }
    });
}

export async function processEmails() {
    const client = await createEmailClient();

    try {
        await client.connect();
        logger.info('Почтовый клиент подключен');

        const lock = await client.getMailboxLock('INBOX');
        try {
            const messages = client.fetch(
                { seen: false, since: new Date(Date.now() - 600_000) },
                { source: true, uid: true }
            );

            for await (const message of messages) {
                try {
                    if (!message.source) continue;

                    const emailContent = message.source.toString();
                    const parsedData = await parseEmail(emailContent);

                    if (parsedData) {
                        const result = await orderProcessor.processOrder({
                            ...parsedData,
                            client_id: `email-${message.uid}-${Date.now()}`,
                            options: parsedData.options || []
                        });

                        if (result.order_id) {
                            await client.messageFlagsAdd(
                                message.uid.toString(),
                                ['\\Seen'],
                                { uid: true }
                            );
                            logger.info(`Обработан заказ из письма: ${result.order_id}`);
                        }
                    }
                } catch (error) {
                    await handleEmailError(message.source?.toString(), error);
                }
            }
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
        logger.info('Почтовый клиент отключен');
    }
}