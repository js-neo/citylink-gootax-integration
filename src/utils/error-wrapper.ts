// src/utils/error-wrapper.ts

export class EnhancedError extends Error {
    constructor(
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
    }

    static from(error: unknown, details?: Record<string, unknown>): EnhancedError {
        const message = error instanceof Error ? error.message : String(error);
        return new EnhancedError(message, {
            ...(error instanceof EnhancedError ? error.details : {}),
            ...details
        });
    }

}