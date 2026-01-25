/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserWindow } from 'electron';
import { ILogService } from '../../../../platform/log/common/log.js';

/**
 * Estratégia de retry para ações do navegador
 */
export interface RetryStrategy {
	maxAttempts: number;
	initialDelayMs: number;
	maxDelayMs: number;
	backoffMultiplier: number;
	strategies: SelectorStrategy[];
}

/**
 * Estratégia de seletor para encontrar elemento
 */
export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'aria-label' | 'attribute';

/**
 * Resultado da execução de retry
 */
export interface RetryResult<T> {
	success: boolean;
	result?: T;
	error?: Error;
	attemptsUsed: number;
	strategies: SelectorStrategy[];
}

export class SmartRetryService {
	private readonly logService: ILogService;

	constructor(logService: ILogService) {
		this.logService = logService;
	}

	/**
	 * Executa ação com retry inteligente
	 */
	async executeWithRetry<T>(
		action: () => Promise<T>,
		strategy: RetryStrategy,
		description: string
	): Promise<RetryResult<T>> {
		let lastError: Error | null = null;
		let delay = strategy.initialDelayMs;

		this.logService.info(`[SmartRetryService] Starting retry loop for: ${description}`);

		for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
			try {
				this.logService.debug(`[SmartRetryService] Attempt ${attempt}/${strategy.maxAttempts}`);

				const result = await action();

				this.logService.info(
					`[SmartRetryService] Success on attempt ${attempt}: ${description}`
				);

				return {
					success: true,
					result,
					attemptsUsed: attempt,
					strategies: strategy.strategies,
				};
			} catch (error) {
				lastError = error as Error;
				this.logService.debug(
					`[SmartRetryService] Attempt ${attempt} failed: ${error}`
				);

				if (attempt < strategy.maxAttempts) {
					this.logService.debug(
						`[SmartRetryService] Waiting ${delay}ms before next attempt`
					);
					await this.wait(delay);

					// Aumentar delay com backoff exponencial
					delay = Math.min(
						delay * strategy.backoffMultiplier,
						strategy.maxDelayMs
					);
				}
			}
		}

		this.logService.error(
			`[SmartRetryService] All ${strategy.maxAttempts} attempts failed for: ${description}`
		);

		return {
			success: false,
			error: lastError || new Error('Unknown error'),
			attemptsUsed: strategy.maxAttempts,
			strategies: strategy.strategies,
		};
	}

	/**
	 * Encontra elemento com múltiplas estratégias
	 */
	async findElementWithRetry(
		browserWindow: BrowserWindow,
		element: string | undefined,
		ref: string | undefined,
		strategies: SelectorStrategy[] = ['css', 'xpath', 'text']
	): Promise<RetryResult<any>> {
		for (const strategy of strategies) {
			try {
				const result = await this.findElementByStrategy(
					browserWindow,
					element,
					ref,
					strategy
				);

				if (result) {
					this.logService.info(
						`[SmartRetryService] Found element using strategy: ${strategy}`
					);
					return {
						success: true,
						result,
						attemptsUsed: 1,
						strategies: [strategy],
					};
				}
			} catch (error) {
				this.logService.debug(
					`[SmartRetryService] Strategy ${strategy} failed: ${error}`
				);
			}
		}

		return {
			success: false,
			error: new Error('Element not found with any strategy'),
			attemptsUsed: strategies.length,
			strategies,
		};
	}

	/**
	 * Encontra elemento usando estratégia específica
	 */
	private async findElementByStrategy(
		browserWindow: BrowserWindow,
		element: string | undefined,
		ref: string | undefined,
		strategy: SelectorStrategy
	): Promise<any> {
		const webContents = browserWindow.webContents;
		const selector = element || ref;

		switch (strategy) {
			case 'css':
				if (!selector) return null;
				return await webContents.executeJavaScript(`
					(() => {
						const el = document.querySelector(${JSON.stringify(selector)});
						return el ? { found: true, element: el.tagName } : null;
					})()
				`);

			case 'xpath':
				if (!selector) return null;
				return await webContents.executeJavaScript(`
					(() => {
						const result = document.evaluate(
							${JSON.stringify(selector)},
							document,
							null,
							XPathResult.FIRST_ORDERED_NODE_TYPE,
							null
						);
						return result.singleNodeValue ? { found: true, element: result.singleNodeValue.tagName } : null;
					})()
				`);

			case 'text':
				if (!element) return null;
				return await webContents.executeJavaScript(`
					(() => {
						const text = ${JSON.stringify(element)};
						const elements = Array.from(document.querySelectorAll('*'));
						const el = elements.find(e => e.textContent?.includes(text));
						return el ? { found: true, element: el.tagName } : null;
					})()
				`);

			case 'aria-label':
				if (!element) return null;
				return await webContents.executeJavaScript(`
					(() => {
						const label = ${JSON.stringify(element)};
						const el = document.querySelector(\`[aria-label="\${label}"]\`);
						return el ? { found: true, element: el.tagName } : null;
					})()
				`);

			case 'attribute':
				if (!ref) return null;
				return await webContents.executeJavaScript(`
					(() => {
						const refValue = ${JSON.stringify(ref)};
						const el = document.querySelector(\`[data-ref="\${refValue}"]\`);
						return el ? { found: true, element: el.tagName } : null;
					})()
				`);

			default:
				throw new Error(`Unknown strategy: ${strategy}`);
		}
	}

	/**
	 * Aguarda um elemento estar visível e clickável
	 */
	async waitForElement(
		browserWindow: BrowserWindow,
		selector: string,
		timeoutMs: number = 10000
	): Promise<boolean> {
		const webContents = browserWindow.webContents;
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				const isReady = await webContents.executeJavaScript(`
					const el = document.querySelector(${JSON.stringify(selector)});
					if (!el) return false;
					
					const rect = el.getBoundingClientRect();
					const isVisible = rect.height > 0 && rect.width > 0;
					const isClickable = !el.disabled && el.offsetParent !== null;
					
					return isVisible && isClickable;
				`);

				if (isReady) {
					this.logService.debug(
						`[SmartRetryService] Element ready: ${selector}`
					);
					return true;
				}
			} catch (error) {
				// Continuar tentando
			}

			await this.wait(500);
		}

		this.logService.warn(
			`[SmartRetryService] Timeout waiting for element: ${selector}`
		);
		return false;
	}

	/**
	 * Aguarda página carregar completamente
	 */
	async waitForPageReady(
		browserWindow: BrowserWindow,
		timeoutMs: number = 30000
	): Promise<boolean> {
		const webContents = browserWindow.webContents;
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				const isReady = await webContents.executeJavaScript(`
					document.readyState === 'complete'
				`);

				if (isReady) {
					this.logService.debug('[SmartRetryService] Page is ready');
					
					// Aguardar mais um pouco para scripts assíncronos
					await new Promise(resolve => setTimeout(resolve, 1000));
					return true;
				}
			} catch (error) {
				// Continuar tentando
			}

			await this.wait(500);
		}

		this.logService.warn('[SmartRetryService] Timeout waiting for page ready');
		return false;
	}

	/**
	 * Detecta e fecha popups/modals
	 */
	async closePopups(browserWindow: BrowserWindow): Promise<number> {
		const webContents = browserWindow.webContents;

		try {
			const closed = await webContents.executeJavaScript(`
				let count = 0;
				
				// Fechar modals
				const modals = document.querySelectorAll('[role="dialog"], .modal, .popup, [aria-modal="true"]');
				modals.forEach(modal => {
					const closeBtn = modal.querySelector('[aria-label="Close"], .close, [data-dismiss="modal"]');
					if (closeBtn) {
						closeBtn.click();
						count++;
					} else {
						modal.remove();
						count++;
					}
				});
				
				// Fechar overlays
				const overlays = document.querySelectorAll('.overlay, .backdrop, [data-overlay]');
				overlays.forEach(overlay => overlay.remove());
				
				count;
			`);

			if (closed > 0) {
				this.logService.info(`[SmartRetryService] Closed ${closed} popups`);
			}

			return closed as number;
		} catch (error) {
			this.logService.debug(`[SmartRetryService] Error closing popups: ${error}`);
			return 0;
		}
	}

	/**
	 * Scrolls para elemento
	 */
	async scrollToElement(
		browserWindow: BrowserWindow,
		selector: string
	): Promise<boolean> {
		const webContents = browserWindow.webContents;

		try {
			await webContents.executeJavaScript(`
				const el = document.querySelector(${JSON.stringify(selector)});
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' });
					return true;
				}
				return false;
			`);

			this.logService.debug(`[SmartRetryService] Scrolled to element: ${selector}`);
			return true;
		} catch (error) {
			this.logService.debug(`[SmartRetryService] Error scrolling: ${error}`);
			return false;
		}
	}

	/**
	 * Detecta erros na página
	 */
	async detectPageErrors(browserWindow: BrowserWindow): Promise<string[]> {
		const webContents = browserWindow.webContents;

		try {
			const errors = await webContents.executeJavaScript(`
				const errorElements = [
					...document.querySelectorAll('[role="alert"]'),
					...document.querySelectorAll('.error, .error-message, [data-error]'),
					...document.querySelectorAll('[class*="error"]'),
				];
				
				const errorTexts = errorElements
					.map(el => el.textContent?.trim())
					.filter(text => text && text.length < 200)
					.slice(0, 5);
				
				Array.from(new Set(errorTexts));
			`);

			return errors as string[];
		} catch (error) {
			this.logService.debug(`[SmartRetryService] Error detecting page errors: ${error}`);
			return [];
		}
	}

	/**
	 * Aguarda condição específica
	 */
	async waitForCondition(
		browserWindow: BrowserWindow,
		condition: () => Promise<boolean>,
		timeoutMs: number = 10000
	): Promise<boolean> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				if (await condition()) {
					return true;
				}
			} catch (error) {
				this.logService.debug(`[SmartRetryService] Condition check error: ${error}`);
			}

			await this.wait(500);
		}

		return false;
	}

	// Private methods

	private wait(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
