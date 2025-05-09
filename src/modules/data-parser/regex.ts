// src/modules/data-parser/regex.ts

export const RegexPatterns = {
    PHONE: /^(?:\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/,
    DATE_TIME: /(\d{1,2})\.(\d{1,2})\.(\d{4})\s(\d{1,2}):(\d{2})/,
    FLIGHT_NUMBER: /[A-Z]{2}\s?\d{2,4}/i
};

export const extractPhone = (text: string) =>
    text.match(RegexPatterns.PHONE)?.[0].replace(/[^\d]/g, '') || null;

export const extractDateTime = (text: string) => {
    const match = text.match(RegexPatterns.DATE_TIME);
    if (!match) return null;
    const [_, day, month, year, hours, minutes] = match;
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);
};