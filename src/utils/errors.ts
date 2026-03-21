// src/utils/errors.ts
// Custom error classes and error handling utilities for Pustakam

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for all Pustakam errors
 */
export class PustakamError extends Error {
    public readonly code: string;
    public readonly details?: Record<string, unknown>;
    public readonly recoverable: boolean;
    public readonly userMessage: string;

    constructor(
        message: string,
        code: string,
        options?: {
            details?: Record<string, unknown>;
            recoverable?: boolean;
            userMessage?: string;
        }
    ) {
        super(message);
        this.name = 'PustakamError';
        this.code = code;
        this.details = options?.details;
        this.recoverable = options?.recoverable ?? true;
        this.userMessage = options?.userMessage ?? message;
    }
}

/**
 * API-related errors (rate limits, authentication, etc.)
 */
export class APIError extends PustakamError {
    public readonly statusCode?: number;
    public readonly provider: string;
    public readonly retryAfter?: number; // seconds

    constructor(
        message: string,
        code: string,
        provider: string,
        options?: {
            statusCode?: number;
            retryAfter?: number;
            details?: Record<string, unknown>;
            userMessage?: string;
        }
    ) {
        super(message, code, {
            details: options?.details,
            recoverable: true,
            userMessage: options?.userMessage,
        });
        this.name = 'APIError';
        this.statusCode = options?.statusCode;
        this.provider = provider;
        this.retryAfter = options?.retryAfter;
    }
}

/**
 * Rate limit specific error
 */
export class RateLimitError extends APIError {
    constructor(
        provider: string,
        retryAfter: number = 60,
        model?: string
    ) {
        super(
            `Rate limit exceeded for ${provider}`,
            'RATE_LIMIT_EXCEEDED',
            provider,
            {
                statusCode: 429,
                retryAfter,
                details: { model },
                userMessage: `You've reached the API rate limit for ${provider}. Please wait ${Math.ceil(retryAfter / 60)} minute(s) before trying again, or switch to a different AI model.`,
            }
        );
        this.name = 'RateLimitError';
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends PustakamError {
    constructor(originalMessage?: string) {
        super(
            originalMessage || 'Network connection failed',
            'NETWORK_ERROR',
            {
                recoverable: true,
                userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
            }
        );
        this.name = 'NetworkError';
    }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends APIError {
    constructor(provider: string) {
        super(
            `Invalid API key for ${provider}`,
            'INVALID_API_KEY',
            provider,
            {
                statusCode: 401,
                userMessage: `Your ${provider} API key is invalid or expired. Please update it in the settings.`,
            }
        );
        this.name = 'AuthenticationError';
    }
}

/**
 * Book generation specific errors
 */
export class GenerationError extends PustakamError {
    public readonly phase: 'roadmap' | 'module' | 'assembly';
    public readonly moduleTitle?: string;

    constructor(
        message: string,
        phase: 'roadmap' | 'module' | 'assembly',
        options?: {
            moduleTitle?: string;
            details?: Record<string, unknown>;
            userMessage?: string;
        }
    ) {
        super(message, `GENERATION_${phase.toUpperCase()}_FAILED`, {
            details: options?.details,
            recoverable: true,
            userMessage: options?.userMessage ?? `Failed to generate ${phase}. Please try again or switch to a different AI model.`,
        });
        this.name = 'GenerationError';
        this.phase = phase;
        this.moduleTitle = options?.moduleTitle;
    }
}

/**
 * Storage/quota errors
 */
export class StorageError extends PustakamError {
    constructor(operation: 'read' | 'write' | 'quota') {
        const messages = {
            read: 'Failed to load your saved data. Please refresh the page.',
            write: 'Failed to save your data. Your browser storage may be full.',
            quota: 'Storage quota exceeded. Please delete some books to free up space.',
        };

        super(messages[operation], `STORAGE_${operation.toUpperCase()}_ERROR`, {
            recoverable: operation !== 'quota',
            userMessage: messages[operation],
        });
        this.name = 'StorageError';
    }
}

// ============================================================================
// Error Parsing Utilities
// ============================================================================

/**
 * Parse an error response from an API and return a structured error
 */
export function parseAPIError(error: unknown, provider: string): PustakamError {
    // Handle fetch/network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return new NetworkError(error.message);
    }

    // Handle Error objects
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Check for rate limit errors
        if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
            const retryMatch = message.match(/retry after (\d+)/i);
            const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;
            return new RateLimitError(provider, retryAfter);
        }

        // Check for authentication errors
        if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid api key')) {
            return new AuthenticationError(provider);
        }

        // Check for network errors
        if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
            return new NetworkError(error.message);
        }

        // Check for quota errors
        if (message.includes('quota') || message.includes('billing')) {
            return new APIError(
                `API quota exceeded for ${provider}`,
                'QUOTA_EXCEEDED',
                provider,
                {
                    userMessage: `Your ${provider} API quota has been exceeded. Please check your billing settings or try again later.`,
                }
            );
        }
    }

    // Default to a generic API error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new APIError(
        errorMessage,
        'API_ERROR',
        provider,
        {
            userMessage: `An error occurred while communicating with ${provider}. Please try again.`,
        }
    );
}

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
    if (error instanceof PustakamError) {
        return error.userMessage;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if an error is recoverable (can be retried)
 */
export function isRecoverableError(error: unknown): boolean {
    if (error instanceof PustakamError) {
        return error.recoverable;
    }

    // Network errors are generally recoverable
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return message.includes('network') || message.includes('timeout') || message.includes('rate limit');
    }

    return true;
}

/**
 * Get recommended action for an error
 */
export function getErrorAction(error: unknown): 'retry' | 'switch_model' | 'check_settings' | 'contact_support' {
    if (error instanceof RateLimitError) {
        return 'switch_model';
    }

    if (error instanceof AuthenticationError) {
        return 'check_settings';
    }

    if (error instanceof NetworkError) {
        return 'retry';
    }

    if (error instanceof PustakamError && error.recoverable) {
        return 'retry';
    }

    return 'contact_support';
}

export default {
    PustakamError,
    APIError,
    RateLimitError,
    NetworkError,
    AuthenticationError,
    GenerationError,
    StorageError,
    parseAPIError,
    getUserFriendlyMessage,
    isRecoverableError,
    getErrorAction,
};
