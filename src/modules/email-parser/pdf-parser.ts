// src/modules/email-parser/pdf-parser.ts
import pdf from 'pdf-parse';
import { logger } from "../../utils/logger.js";

export async function parsePDF(buffer: Buffer): Promise<string> {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        logger.error('Не удалось выполнить синтаксический анализ PDF-файлов:', error);
        return '';
    }
}