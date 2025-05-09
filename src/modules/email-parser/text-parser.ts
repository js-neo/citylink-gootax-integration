// src/modules/email-parser/text-parser.ts

import { RegexPatterns } from '../data-parser/regex.js';
import { NLPParser } from '../data-parser/nlp.js';
import type { EmailOrderData } from './types.js';

const nlpParser = new NLPParser();

export async function extractDataFromText(text: string): Promise<{
    pickupAddress: string;
    dropoffAddress: string;
    time: Date;
    phone: string;
    vehicleType: 'sedan' | 'minivan';
}> {
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    const dateTimeMatch = normalizedText.match(RegexPatterns.DATE_TIME);
    const time = dateTimeMatch ?
        new Date(dateTimeMatch[0]) :
        new Date();

    const phoneMatch = normalizedText.match(RegexPatterns.PHONE);
    const phone = phoneMatch ?
        phoneMatch[0].replace(/\D/g, '').replace(/^8/, '7') :
        '';

    const { addresses } = await nlpParser.extractEntities(normalizedText);

    return {
        pickupAddress: addresses[0] || '',
        dropoffAddress: addresses[1] || '',
        time,
        phone,
        vehicleType: normalizedText.includes('минивэн') ? 'minivan' : 'sedan'
    };
}