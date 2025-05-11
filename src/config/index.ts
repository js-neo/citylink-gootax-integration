// src/config/index.ts

import dotenv from 'dotenv';
dotenv.config();

export const config = {
    gootax: {
        appId: process.env.GOOTAX_APP_ID || '5528',
        tenantId: process.env.GOOTAX_TENANT_ID || '2492',
        secret: process.env.GOOTAX_SECRET || '',
        dispatcherId: process.env.DISPATCHER_ID || ''
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '0', 10)
    },
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
};