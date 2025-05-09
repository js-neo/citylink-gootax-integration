// src/modules/email-parser/types.ts
export interface EmailOrderData {
    rawAddresses: [string, string];
    client_id: string;
    phone: string;
    vehicleType: 'sedan' | 'minivan';
    time: Date;
    options: string[];
    source: 'email';
    rawData?: string;
}

export interface EmailProcessingResult {
    success: boolean;
    orderId?: string;
    error?: string;
}