// src/modules/email-parser/email-parser.ts

import { simpleParser } from 'mailparser';
import { extractDataFromText } from './text-parser.js';
import { parsePDF } from './pdf-parser.js';
import type { EmailOrderData } from './types.js';
import { logger } from "../../utils/logger.js";

export async function parseEmail(rawEmail: string): Promise<EmailOrderData | null> {
    try {
        const parsed = await simpleParser(rawEmail);
        const textContent = parsed.text || parsed.html || '';

        const pdfContents = await Promise.all(
            parsed.attachments
                .filter(a => a.contentType === 'application/pdf')
                .map(a => parsePDF(a.content))
        );

        const combinedText = [textContent, ...pdfContents]
            .filter(Boolean)
            .join('\n\n');

        const extracted = await extractDataFromText(combinedText);

        if (!extracted.pickupAddress || !extracted.dropoffAddress) {
            throw new Error('Не удалось извлечь адреса из письма');
        }

        return {
            rawAddresses: [extracted.pickupAddress, extracted.dropoffAddress],
            client_id: `email-${Date.now()}`,
            phone: extracted.phone,
            vehicleType: extracted.vehicleType,
            time: extracted.time,
            options: [],
            source: 'email',
            rawData: rawEmail
        };
    } catch (error) {
        logger.error('Ошибка разбора письма:', error);
        return null;
    }
}