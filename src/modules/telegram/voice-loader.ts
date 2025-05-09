// src/modules/telegram/voice-loader.ts

import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';

const TG_FILE_API = `https://api.telegram.org/bot${process.env.TG_TOKEN}/getFile`;
const TG_FILE_DOWNLOAD = `https://api.telegram.org/file/bot${process.env.TG_TOKEN}`;

export class TelegramVoiceLoader {
    private readonly redis = getRedisClient();

    async downloadVoiceMessage(fileId: string): Promise<Buffer> {
        try {
            const cached = await this.redis.get(`voice:${fileId}`);
            if (cached) return Buffer.from(cached, 'base64');

            const fileInfo = await axios.get(TG_FILE_API, {
                params: { file_id: fileId }
            });

            const response = await axios.get(`${TG_FILE_DOWNLOAD}/${fileInfo.data.result.file_path}`, {
                responseType: 'arraybuffer'
            });

            await this.redis.setex(`voice:${fileId}`, 3600, Buffer.from(response.data).toString('base64'));

            return response.data;
        } catch (error) {
            logger.error('Ошибка загрузки голосового сообщения:', error);
            throw new Error('Не удалось загрузить голосовое сообщение');
        }
    }

    async convertToWav(oggBuffer: Buffer): Promise<Buffer> {
        return oggBuffer;
    }
}