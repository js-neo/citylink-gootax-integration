// src/config/index.ts

export const config = {
    gootax: {
        appId: process.env.GOOTAX_APP_ID!,
        tenantId: process.env.GOOTAX_TENANT_ID!,
        secret: process.env.GOOTAX_SECRET!,
        dispatcherId: process.env.DISPATCHER_ID!
    },
    redis: {
        host: process.env.REDIS_HOST!,
        port: parseInt(process.env.REDIS_PORT!),
        password: process.env.REDIS_PASSWORD!
    },
    smtp: {
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT!),
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!
    }
};