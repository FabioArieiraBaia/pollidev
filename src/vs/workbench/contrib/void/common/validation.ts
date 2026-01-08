/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Validation result for inputs.
 * All validations are non-destructive - they only warn, never block functionality.
 */
export interface ValidationResult {
	isValid: boolean;
	warnings: ValidationWarning[];
	errors: ValidationError[];
}

export interface ValidationWarning {
	message: string;
	suggestion?: string;
}

export interface ValidationError {
	message: string;
	suggestion?: string;
	code?: string;
}

/**
 * Validate a prompt input.
 * @param prompt - The prompt text to validate
 * @returns Validation result with warnings/errors (non-blocking)
 */
export function validatePrompt(prompt: string): ValidationResult {
	const warnings: ValidationWarning[] = [];
	const errors: ValidationError[] = [];

	// Empty prompt warning
	if (!prompt || prompt.trim().length === 0) {
		warnings.push({
			message: 'Prompt is empty',
			suggestion: 'Enter a prompt to get better results',
		});
	}

	// Very long prompt warning
	if (prompt.length > 100000) {
		warnings.push({
			message: 'Prompt is very long',
			suggestion: 'Consider breaking this into smaller parts for better performance',
		});
	}

	// Check for potentially problematic patterns (warnings only, never blocking)
	if (prompt.includes('```') && prompt.split('```').length % 2 === 0) {
		warnings.push({
			message: 'Unclosed code block detected',
			suggestion: 'Make sure all code blocks are properly closed with triple backticks',
		});
	}

	return {
		isValid: errors.length === 0,
		warnings,
		errors,
	};
}

/**
 * Model parameters validation type.
 */
export interface ModelParameters {
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}

/**
 * Validate model parameters.
 * @param params - Model parameters to validate
 * @returns Validation result with warnings/errors (non-blocking)
 */
export function validateModelParameters(params: ModelParameters): ValidationResult {
	const warnings: ValidationWarning[] = [];
	const errors: ValidationError[] = [];

	// Temperature validation
	if (params.temperature !== undefined) {
		if (params.temperature < 0 || params.temperature > 2) {
			warnings.push({
				message: 'Temperature should be between 0 and 2',
				suggestion: 'Consider using a value between 0.7 and 1.0 for most use cases',
			});
		}
	}

	// Max tokens validation
	if (params.maxTokens !== undefined) {
		if (params.maxTokens < 1) {
			warnings.push({
				message: 'Max tokens should be greater than 0',
				suggestion: 'Set a positive value for maximum output length',
			});
		} else if (params.maxTokens > 100000) {
			warnings.push({
				message: 'Max tokens is very high',
				suggestion: 'Consider if you really need such a large output limit',
			});
		}
	}

	// Top P validation
	if (params.topP !== undefined) {
		if (params.topP < 0 || params.topP > 1) {
			warnings.push({
				message: 'Top P should be between 0 and 1',
				suggestion: 'Use a value between 0.9 and 1.0 for most cases',
			});
		}
	}

	// Frequency penalty validation
	if (params.frequencyPenalty !== undefined) {
		if (params.frequencyPenalty < -2 || params.frequencyPenalty > 2) {
			warnings.push({
				message: 'Frequency penalty should be between -2 and 2',
				suggestion: 'Use values between -0.5 and 0.5 for subtle effects',
			});
		}
	}

	// Presence penalty validation
	if (params.presencePenalty !== undefined) {
		if (params.presencePenalty < -2 || params.presencePenalty > 2) {
			warnings.push({
				message: 'Presence penalty should be between -2 and 2',
				suggestion: 'Use values between -0.5 and 0.5 for subtle effects',
			});
		}
	}

	return {
		isValid: errors.length === 0,
		warnings,
		errors,
	};
}

/**
 * Provider settings validation type.
 */
export interface ProviderSettings {
	apiKey?: string;
	endpoint?: string;
	[key: string]: any;
}

/**
 * Validate provider settings.
 * @param settings - Provider settings to validate
 * @returns Validation result with warnings/errors (non-blocking)
 */
export function validateProviderSettings(settings: ProviderSettings): ValidationResult {
	const warnings: ValidationWarning[] = [];
	const errors: ValidationError[] = [];

	// API key validation
	if (settings.apiKey !== undefined) {
		if (!settings.apiKey || settings.apiKey.trim().length === 0) {
			warnings.push({
				message: 'API key is empty',
				suggestion: 'Enter a valid API key to use this provider',
			});
		} else if (settings.apiKey.length < 10) {
			warnings.push({
				message: 'API key seems too short',
				suggestion: 'Make sure you entered the complete API key',
			});
		}
	}

	// Endpoint validation
	if (settings.endpoint !== undefined) {
		if (!settings.endpoint || settings.endpoint.trim().length === 0) {
			warnings.push({
				message: 'Endpoint is empty',
				suggestion: 'Enter a valid endpoint URL',
			});
		} else {
			try {
				const url = new URL(settings.endpoint);
				if (!['http:', 'https:'].includes(url.protocol)) {
					warnings.push({
						message: 'Endpoint should use HTTP or HTTPS protocol',
						suggestion: 'Use a valid URL starting with http:// or https://',
					});
				}
			} catch (e) {
				warnings.push({
					message: 'Endpoint URL is invalid',
					suggestion: 'Enter a valid URL (e.g., https://api.example.com)',
				});
			}
		}
	}

	return {
		isValid: errors.length === 0,
		warnings,
		errors,
	};
}


