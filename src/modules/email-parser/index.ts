// src/modules/email-parser/index.ts
export * from './types.js';
export * from './email-client.js';
export * from './email-parser.js';
export * from './error-handler.js';
export * from './pdf-parser.js';
export * from './text-parser.js';

export { processEmails as checkEmails } from './email-client.js';