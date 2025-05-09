import { TelegramParsedData } from './types.js';

export function extractTelegramData(text: string): TelegramParsedData {
    const addressMatch = text.split(/[->,]/).map(s => s.trim()).filter(Boolean);
    if (addressMatch.length < 2) {
        throw new Error('Не найдены адреса. Укажите в формате: "откуда -> куда"');
    }

    const phoneMatch = text.match(/(?:\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
    if (!phoneMatch) {
        throw new Error('Не найден номер телефона');
    }

    const dateMatch = text.match(/(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s+(\d{1,2}:\d{2})/)
        || text.match(/(завтра|сегодня)\s+(\d{1,2}:\d{2})/i);

    return {
        from: addressMatch[0],
        to: addressMatch[1],
        phone: phoneMatch[0],
        datetime: dateMatch ? formatDateMatch(dateMatch) : new Date().toISOString(),
        vehicleType: text.toLowerCase().includes('минивэн') ? 'minivan' : 'sedan',
        options: text.includes('детское') ? ['child_seat'] : []
    };
}

function formatDateMatch(match: RegExpMatchArray): string {
    const now = new Date();
    if (match[1].toLowerCase() === 'сегодня') {
        return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            parseInt(match[2]),
            parseInt(match[3])
        ).toISOString();
    }
    if (match[1].toLowerCase() === 'завтра') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return new Date(
            tomorrow.getFullYear(),
            tomorrow.getMonth(),
            tomorrow.getDate(),
            parseInt(match[2]),
            parseInt(match[3])
        ).toISOString();
    }

    const [day, month, year] = match[1].split('.');
    return new Date(
        year ? parseInt(year) : now.getFullYear(),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(match[2]),
        parseInt(match[3])
    ).toISOString();
}