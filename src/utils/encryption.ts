// src/utils/encryption.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export const encrypt = (text: string) => {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
        tag: cipher.getAuthTag().toString('hex')
    };
};

export const decrypt = (encrypted: { iv: string; content: string; tag: string }) => {
    const decipher = createDecipheriv(
        ALGORITHM,
        KEY,
        Buffer.from(encrypted.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(encrypted.content, 'hex')),
        decipher.final()
    ]).toString();
};