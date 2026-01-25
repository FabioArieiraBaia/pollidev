/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { BrowserAction } from './sharedBrowserService.js';
import { DOMSnapshot } from './domAnalysisService.js';
import { BrowserStateSnapshot } from './browserStateTracker.js';

/**
 * Motivo da falha de ação
 */
export enum FailureReason {
	ELEMENT_NOT_FOUND = 'element_not_found',
	ELEMENT_NOT_CLICKABLE = 'element_not_clickable',
	NAVIGATION_TIMEOUT = 'navigation_timeout',
	NAVIGATION_ERROR = 'navigation_error',
	PAGE_ERROR = 'page_error',
	UNEXPECTED_URL = 'unexpected_url',
	FORM_VALIDATION_ERROR = 'form_validation_error',
	POPUP_APPEARED = 'popup_appeared',
	ELEMENT_HIDDEN = 'element_hidden',
	ELEMENT_DISABLED = 'element_disabled',
	NETWORK_ERROR = 'network_error',
	TIMEOUT = 'timeout',
	UNKNOWN = 'unknown',
}

/**
 * Sugestão de recuperação de erro
 */
export interface RecoverySuggestion {
	action: 'retry' | 'alternative' | 'skip' | 'navigate' | 'wait' | 'screenshot';
	description: string;
	element?: string;
	url?: string;
	delay?: number;
	confidence: number;
}

/**
 * Análise de falha de ação
 */
export interface ActionFailure {
	action: BrowserAction;
	reason: FailureReason;
	message: string;
	suggestions: RecoverySuggestion[];
	timestamp: number;
	context: {
		domSnapshot: DOMSnapshot | null;
		previousState: BrowserStateSnapshot | null;
		errorMessage?: string;
	};
}

export const IFailureAnalysisService = createDecorator<IFailureAnalysisService>('FailureAnalysisService');

export interface IFailureAnalysisService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Analisa uma falha de ação e retorna sugestões
	 */
	analyzeFailure(
		action: BrowserAction,
		error: Error | string,
		context?: {
			domSnapshot?: DOMSnapshot;
			previousState?: BrowserStateSnapshot;
		}
	): ActionFailure;
	
	/**
	 * Gera estratégias de retry inteligente
	 */
	generateRetryStrategy(failure: ActionFailure): RecoverySuggestion[];
	
	/**
	 * Detecta se é um erro transitório (pode passar com retry)
	 */
	isTransientError(reason: FailureReason): boolean;
	
	/**
	 * Detecta se é um erro permanente (não vai passar com retry)
	 */
	isPermanentError(reason: FailureReason): boolean;
}

export class FailureAnalysisService extends Disposable implements IFailureAnalysisService {
	_serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	analyzeFailure(
		action: BrowserAction,
		error: Error | string,
		context?: {
			domSnapshot?: DOMSnapshot;
			previousState?: BrowserStateSnapshot;
		}
	): ActionFailure {
		try {
			const errorMessage = String(error);
			const reason = this._determineFailureReason(action, errorMessage, context);
			const suggestions = this.generateRetryStrategy({
				action,
				reason,
				message: errorMessage,
				suggestions: [],
				timestamp: Date.now(),
				context: {
					domSnapshot: context?.domSnapshot || null,
					previousState: context?.previousState || null,
					errorMessage,
				},
			});

			const failure: ActionFailure = {
				action,
				reason,
				message: this._getFailureMessage(reason),
				suggestions,
				timestamp: Date.now(),
				context: {
					domSnapshot: context?.domSnapshot || null,
					previousState: context?.previousState || null,
					errorMessage,
				},
			};

			this.logService.warn(`[FailureAnalysisService] Analyzed failure: ${reason} - ${errorMessage}`);

			return failure;
		} catch (error) {
			this.logService.error(`[FailureAnalysisService] Error analyzing failure: ${error}`);

			return {
				action,
				reason: FailureReason.UNKNOWN,
				message: 'Unknown error occurred',
				suggestions: [{
					action: 'screenshot',
					description: 'Take a screenshot to see current page state',
					confidence: 0.8,
				}],
				timestamp: Date.now(),
				context: {
					domSnapshot: null,
					previousState: null,
					errorMessage: String(error),
				},
			};
		}
	}

	generateRetryStrategy(failure: ActionFailure): RecoverySuggestion[] {
		const suggestions: RecoverySuggestion[] = [];

		const isTransient = this.isTransientError(failure.reason);
		const isPermanent = this.isPermanentError(failure.reason);

		switch (failure.reason) {
			case FailureReason.ELEMENT_NOT_FOUND:
				if (isTransient) {
					// Elemento pode estar carregando ainda
					suggestions.push({
						action: 'wait',
						description: 'Wait for element to load',
						delay: 2000,
						confidence: 0.7,
					});
				}
				
				suggestions.push({
					action: 'screenshot',
					description: 'Take screenshot to identify element',
					confidence: 0.9,
				});

				if (!isPermanent) {
					suggestions.push({
						action: 'retry',
						description: 'Retry with same selector after waiting',
						confidence: 0.6,
					});
				}
				break;

			case FailureReason.ELEMENT_HIDDEN:
				suggestions.push({
					action: 'screenshot',
					description: 'Element might be hidden, verify visibility',
					confidence: 0.9,
				});

				suggestions.push({
					action: 'alternative',
					description: 'Try scrolling to element or using different selector',
					confidence: 0.6,
				});
				break;

			case FailureReason.ELEMENT_DISABLED:
				suggestions.push({
					action: 'wait',
					description: 'Element is disabled, wait for it to be enabled',
					delay: 1000,
					confidence: 0.7,
				});

				suggestions.push({
					action: 'screenshot',
					description: 'Verify element state',
					confidence: 0.8,
				});
				break;

			case FailureReason.NAVIGATION_TIMEOUT:
			case FailureReason.TIMEOUT:
				suggestions.push({
					action: 'wait',
					description: 'Wait for page to load',
					delay: 3000,
					confidence: 0.8,
				});

				suggestions.push({
					action: 'retry',
					description: 'Retry navigation after waiting',
					confidence: 0.7,
				});
				break;

			case FailureReason.NAVIGATION_ERROR:
			case FailureReason.NETWORK_ERROR:
				suggestions.push({
					action: 'screenshot',
					description: 'Check if page loaded with error',
					confidence: 0.9,
				});

				suggestions.push({
					action: 'alternative',
					description: 'Try navigating to homepage first',
					url: 'about:blank',
					confidence: 0.5,
				});
				break;

			case FailureReason.PAGE_ERROR:
				suggestions.push({
					action: 'screenshot',
					description: 'Take screenshot to see error',
					confidence: 0.95,
				});

				suggestions.push({
					action: 'wait',
					description: 'Wait for error to be resolved',
					delay: 2000,
					confidence: 0.4,
				});
				break;

			case FailureReason.POPUP_APPEARED:
				suggestions.push({
					action: 'screenshot',
					description: 'See what popup appeared',
					confidence: 0.95,
				});

				suggestions.push({
					action: 'alternative',
					description: 'Look for close button or overlay',
					confidence: 0.6,
				});
				break;

			case FailureReason.FORM_VALIDATION_ERROR:
				suggestions.push({
					action: 'screenshot',
					description: 'See validation error message',
					confidence: 0.95,
				});

				suggestions.push({
					action: 'alternative',
					description: 'Try different input values',
					confidence: 0.6,
				});
				break;

			default:
				suggestions.push({
					action: 'screenshot',
					description: 'Take screenshot to diagnose issue',
					confidence: 0.8,
				});
		}

		return suggestions;
	}

	isTransientError(reason: FailureReason): boolean {
		const transientErrors = [
			FailureReason.TIMEOUT,
			FailureReason.NAVIGATION_TIMEOUT,
			FailureReason.NETWORK_ERROR,
			FailureReason.ELEMENT_NOT_FOUND, // Pode estar carregando
			FailureReason.ELEMENT_DISABLED,
		];

		return transientErrors.includes(reason);
	}

	isPermanentError(reason: FailureReason): boolean {
		const permanentErrors = [
			FailureReason.PAGE_ERROR,
			FailureReason.UNEXPECTED_URL,
			FailureReason.NAVIGATION_ERROR,
		];

		return permanentErrors.includes(reason);
	}

	// Private methods

	private _determineFailureReason(
		action: BrowserAction,
		errorMessage: string,
		context?: any
	): FailureReason {
		const msg = errorMessage.toLowerCase();

		// Verificar mensagens de erro específicas
		if (msg.includes('not found') || msg.includes('element not found')) {
			return FailureReason.ELEMENT_NOT_FOUND;
		}

		if (msg.includes('not clickable') || msg.includes('obscured')) {
			return FailureReason.ELEMENT_NOT_CLICKABLE;
		}

		if (msg.includes('timeout')) {
			if (action.type === 'navigate') {
				return FailureReason.NAVIGATION_TIMEOUT;
			}
			return FailureReason.TIMEOUT;
		}

		if (msg.includes('network') || msg.includes('connection')) {
			return FailureReason.NETWORK_ERROR;
		}

		if (msg.includes('navigation') || msg.includes('failed to navigate')) {
			return FailureReason.NAVIGATION_ERROR;
		}

		if (msg.includes('error') || msg.includes('exception')) {
			return FailureReason.PAGE_ERROR;
		}

		if (msg.includes('hidden') || msg.includes('not visible')) {
			return FailureReason.ELEMENT_HIDDEN;
		}

		if (msg.includes('disabled')) {
			return FailureReason.ELEMENT_DISABLED;
		}

		if (msg.includes('validation')) {
			return FailureReason.FORM_VALIDATION_ERROR;
		}

		if (msg.includes('popup') || msg.includes('modal')) {
			return FailureReason.POPUP_APPEARED;
		}

		// Se não conseguir identificar, retornar UNKNOWN
		return FailureReason.UNKNOWN;
	}

	private _getFailureMessage(reason: FailureReason): string {
		const messages: Record<FailureReason, string> = {
			[FailureReason.ELEMENT_NOT_FOUND]: 'Element was not found on the page',
			[FailureReason.ELEMENT_NOT_CLICKABLE]: 'Element is not in a clickable state',
			[FailureReason.NAVIGATION_TIMEOUT]: 'Navigation took too long to complete',
			[FailureReason.NAVIGATION_ERROR]: 'Navigation failed with an error',
			[FailureReason.PAGE_ERROR]: 'Page encountered an error',
			[FailureReason.UNEXPECTED_URL]: 'Navigation resulted in unexpected URL',
			[FailureReason.FORM_VALIDATION_ERROR]: 'Form validation error',
			[FailureReason.POPUP_APPEARED]: 'A popup or modal appeared and blocked action',
			[FailureReason.ELEMENT_HIDDEN]: 'Element is hidden or not visible',
			[FailureReason.ELEMENT_DISABLED]: 'Element is disabled',
			[FailureReason.NETWORK_ERROR]: 'Network error occurred',
			[FailureReason.TIMEOUT]: 'Action timed out',
			[FailureReason.UNKNOWN]: 'Unknown error occurred',
		};

		return messages[reason] || 'Unknown error';
	}
}
