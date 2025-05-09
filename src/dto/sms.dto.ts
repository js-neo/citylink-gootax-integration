// src/dto/sms.dto.ts
export interface SmsOrderData {
    text: string;
    phone: string;
    date: string;
    time: string;
    from: string;
    to: string;
    vehicleType: 'sedan' | 'minivan';
}

export interface ProcessedSmsOrder {
    rawAddresses: [string, string];
    client_id: string;
    phone: string;
    vehicleType: 'sedan' | 'minivan';
    time: Date;
    options: string[];
}