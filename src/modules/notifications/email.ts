// src/modules/notifications/email.ts

import nodemailer from 'nodemailer';
import hbs from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

interface EmailTemplateData {
    orderId: string;
    pickupAddress: string;
    dropoffAddress: string;
    formattedTime: string;
}

interface EmailOrderDetails {
    orderId: string;
    pickupAddress: string;
    dropoffAddress: string;
    time: Date | string;
    driverName?: string;
    driverPhone?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
    }
});

const templatePath = join(__dirname, '../../templates/order-confirmation.hbs');
const template = hbs.compile<EmailTemplateData>(readFileSync(templatePath, 'utf8'));

export const sendOrderEmail = async (email: string, orderDetails: EmailOrderDetails) => {
    try {
        const time = typeof orderDetails.time === 'string'
            ? new Date(orderDetails.time)
            : orderDetails.time;

        await transporter.sendMail({
            to: email,
            subject: 'Ваш заказ подтверждён',
            html: template({
                orderId: orderDetails.orderId,
                pickupAddress: orderDetails.pickupAddress,
                dropoffAddress: orderDetails.dropoffAddress,
                formattedTime: time.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            })
        });

        logger.info(`Электронное письмо, отправленно на адрес ${email}`);
    } catch (error) {
        logger.error('Не удалось отправить электронное письмо:', error instanceof Error ? error.message : error);
        throw error;
    }
};