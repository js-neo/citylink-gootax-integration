// src/utils/logger.ts

import winston from 'winston';
import colors from 'colors';

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf((info) => {
            const level = info.level.toUpperCase();
            const message = typeof info.message === 'object'
                ? JSON.stringify(info.message, null, 2)
                : info.message;

            let coloredLevel: string;
            switch (info.level) {
                case 'error':
                    coloredLevel = colors.red(level);
                    break;
                case 'warn':
                    coloredLevel = colors.yellow(level);
                    break;
                case 'info':
                    coloredLevel = colors.green(level);
                    break;
                case 'debug':
                    coloredLevel = colors.blue(level);
                    break;
                default:
                    coloredLevel = level;
            }

            const timestamp = typeof info.timestamp === 'string' ? info.timestamp : '';
            return `${colors.gray(timestamp)} ${coloredLevel}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

export { logger };