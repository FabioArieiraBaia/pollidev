/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Error categories for better error handling and user messaging.
 */
export enum ErrorCategory {
	Network = 'network',
	API = 'api',
	Validation = 'validation',
	System = 'system',
	Unknown = 'unknown',
}

/**
 * Enhanced error information with categorization and suggestions.
 */
export interface EnhancedError {
	category: ErrorCategory;
	message: string;
	suggestion?: string;
	documentationLink?: string;
	errorCode?: string;
	originalError?: Error;
	retryable: boolean;
}

/**
 * Categorize an error and provide helpful information.
 */
export function categorizeError(error: Error | unknown): EnhancedError {
	// Handle string errors
	if (typeof error === 'string') {
		return {
			category: ErrorCategory.Unknown,
			message: error,
			retryable: false,
		};
	}

	// Handle Error objects
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Network errors
		if (
			message.includes('network') ||
			message.includes('fetch') ||
			message.includes('timeout') ||
			message.includes('connection') ||
			error.name === 'NetworkError' ||
			error.name === 'TypeError'
		) {
			return {
				category: ErrorCategory.Network,
				message: 'Network connection error',
				suggestion: 'Check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
				documentationLink: 'https://docs.pollinations.ai',
				errorCode: 'NETWORK_ERROR',
				originalError: error,
				retryable: true,
			};
		}

		// API errors (4xx, 5xx)
		if (
			message.includes('401') ||
			message.includes('unauthorized') ||
			message.includes('authentication')
		) {
			return {
				category: ErrorCategory.API,
				message: 'Authentication failed',
				suggestion: 'Check your API key in settings. Make sure it is valid and has the required permissions.',
				documentationLink: 'https://docs.pollinations.ai/authentication',
				errorCode: 'AUTH_ERROR',
				originalError: error,
				retryable: false,
			};
		}

		if (
			message.includes('403') ||
			message.includes('forbidden') ||
			message.includes('permission')
		) {
			return {
				category: ErrorCategory.API,
				message: 'Permission denied',
				suggestion: 'Your API key does not have permission to perform this action. Check your API key permissions.',
				documentationLink: 'https://docs.pollinations.ai/permissions',
				errorCode: 'PERMISSION_ERROR',
				originalError: error,
				retryable: false,
			};
		}

		if (
			message.includes('429') ||
			message.includes('rate limit') ||
			message.includes('too many requests')
		) {
			return {
				category: ErrorCategory.API,
				message: 'Rate limit exceeded',
				suggestion: 'You have made too many requests. Please wait a moment and try again.',
				documentationLink: 'https://docs.pollinations.ai/rate-limits',
				errorCode: 'RATE_LIMIT_ERROR',
				originalError: error,
				retryable: true,
			};
		}

		if (
			message.includes('400') ||
			message.includes('bad request') ||
			message.includes('invalid')
		) {
			return {
				category: ErrorCategory.Validation,
				message: 'Invalid request',
				suggestion: 'Check your input parameters and make sure they are valid.',
				documentationLink: 'https://docs.pollinations.ai/api',
				errorCode: 'VALIDATION_ERROR',
				originalError: error,
				retryable: false,
			};
		}

		if (
			message.includes('500') ||
			message.includes('502') ||
			message.includes('503') ||
			message.includes('server error') ||
			message.includes('internal error')
		) {
			return {
				category: ErrorCategory.API,
				message: 'Server error',
				suggestion: 'The service is experiencing issues. Please try again in a few moments.',
				documentationLink: 'https://status.pollinations.ai',
				errorCode: 'SERVER_ERROR',
				originalError: error,
				retryable: true,
			};
		}

		// Validation errors
		if (
			message.includes('validation') ||
			message.includes('invalid input') ||
			message.includes('required')
		) {
			return {
				category: ErrorCategory.Validation,
				message: error.message,
				suggestion: 'Please check your input and make sure all required fields are filled correctly.',
				errorCode: 'VALIDATION_ERROR',
				originalError: error,
				retryable: false,
			};
		}
	}

	// Unknown error
	return {
		category: ErrorCategory.Unknown,
		message: error instanceof Error ? error.message : 'An unexpected error occurred',
		suggestion: 'If this problem persists, please check the documentation or contact support.',
		documentationLink: 'https://docs.pollinations.ai',
		errorCode: 'UNKNOWN_ERROR',
		originalError: error instanceof Error ? error : undefined,
		retryable: false,
	};
}

/**
 * Get a user-friendly error message for display.
 */
export function getUserFriendlyErrorMessage(error: Error | unknown): string {
	const enhanced = categorizeError(error);
	return enhanced.message;
}

/**
 * Check if an error is retryable.
 */
export function isErrorRetryable(error: Error | unknown): boolean {
	return categorizeError(error).retryable;
}


