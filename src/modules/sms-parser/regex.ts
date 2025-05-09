// src/modules/sms-parser/regex.ts
interface SmsParsedData {
    date: string;
    time: string;
    from: string;
    to: string;
    phone: string;
    vehicleType: 'sedan' | 'minivan';
}

export const SmsPatterns = {
    TRANSFER: /(?:трансфер|перевозка|заказ)\s+(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s+(\d{1,2}:\d{2})\s+([^\->]+)\s*[->]\s*([^\->]+)\s+(\+?\d{10,11})/i,
    VEHICLE_TYPE: /(минивэн|микроавтобус|седа[нн]|стандарт)/i
};

export const extractSmsData = (text: string): SmsParsedData | null => {
    const match = text.match(SmsPatterns.TRANSFER);
    if (!match) return null;

    const [_, date, time, from, to, phone] = match;
    const vehicleMatch = text.match(SmsPatterns.VEHICLE_TYPE);

    let vehicleType: 'sedan' | 'minivan' = 'sedan';
    if (vehicleMatch) {
        vehicleType = vehicleMatch[1].toLowerCase().includes('мин') ? 'minivan' : 'sedan';
    }

    return {
        date,
        time,
        from: from.trim(),
        to: to.trim(),
        phone: phone.replace(/[^\d]/g, '').replace(/^8/, '7'),
        vehicleType
    };
};