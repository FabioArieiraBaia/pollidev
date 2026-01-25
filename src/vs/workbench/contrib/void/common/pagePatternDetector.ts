/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { DOMSnapshot, ElementInfo, FormInfo } from './domAnalysisService.js';

/**
 * Tipo de padrão de página detectado
 */
export type PagePatternType = 
	| 'login'
	| 'search'
	| 'form'
	| 'ecommerce'
	| 'dashboard'
	| 'documentation'
	| 'api'
	| 'unknown';

/**
 * Ação sugerida para o agente
 */
export interface SuggestedAction {
	type: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'screenshot';
	element?: string;
	ref?: string;
	url?: string;
	text?: string;
	reason: string;
	confidence: number;
}

/**
 * Padrão detectado em uma página
 */
export interface PagePattern {
	type: PagePatternType;
	confidence: number;              // 0-1
	indicators: string[];            // O que foi detectado
	suggestedActions: SuggestedAction[];
	description: string;
	metadata: Record<string, any>;
}

export const IPagePatternDetector = createDecorator<IPagePatternDetector>('PagePatternDetector');

export interface IPagePatternDetector {
	readonly _serviceBrand: undefined;
	
	/**
	 * Detecta o padrão/tipo de página
	 */
	detectPattern(snapshot: DOMSnapshot): PagePattern;
	
	/**
	 * Encontra caixa de busca
	 */
	findSearchBox(elements: ElementInfo[]): ElementInfo | null;
	
	/**
	 * Encontra formulário de login
	 */
	findLoginForm(forms: FormInfo[], elements: ElementInfo[]): FormInfo | null;
	
	/**
	 * Encontra formulário genérico
	 */
	findForm(forms: FormInfo[]): FormInfo | null;
	
	/**
	 * Sugere próximos passos com base no padrão
	 */
	suggestNextSteps(pattern: PagePattern, elements: ElementInfo[]): SuggestedAction[];
}

export class PagePatternDetector extends Disposable implements IPagePatternDetector {
	_serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	detectPattern(snapshot: DOMSnapshot): PagePattern {
		try {
			const indicators: string[] = [];
			let type: PagePatternType = 'unknown';
			let confidence = 0;

			// Verificar cada tipo de padrão
			const loginPattern = this._detectLogin(snapshot, indicators);
			const searchPattern = this._detectSearch(snapshot, indicators);
			const ecommercePattern = this._detectEcommerce(snapshot, indicators);
			const formPattern = this._detectForm(snapshot, indicators);
			const dashboardPattern = this._detectDashboard(snapshot, indicators);
			const apiPattern = this._detectAPI(snapshot, indicators);

			// Determinar padrão com maior confiança
			const patterns = [
				{ type: 'login' as PagePatternType, confidence: loginPattern },
				{ type: 'search' as PagePatternType, confidence: searchPattern },
				{ type: 'ecommerce' as PagePatternType, confidence: ecommercePattern },
				{ type: 'form' as PagePatternType, confidence: formPattern },
				{ type: 'dashboard' as PagePatternType, confidence: dashboardPattern },
				{ type: 'api' as PagePatternType, confidence: apiPattern },
			];

			const bestMatch = patterns.reduce((prev, curr) => 
				curr.confidence > prev.confidence ? curr : prev
			);

			type = bestMatch.type;
			confidence = bestMatch.confidence;

			const suggestedActions = this.suggestNextSteps(
				{ type, confidence, indicators, suggestedActions: [], description: '', metadata: {} },
				snapshot.elements
			);

			return {
				type,
				confidence,
				indicators,
				suggestedActions,
				description: this._getPatternDescription(type),
				metadata: {
					formCount: snapshot.forms.length,
					buttonCount: snapshot.buttons.length,
					inputCount: snapshot.inputs.length,
					linkCount: snapshot.links.length,
				},
			};
		} catch (error) {
			this.logService.error(`[PagePatternDetector] Error detecting pattern: ${error}`);
			
			return {
				type: 'unknown',
				confidence: 0,
				indicators: [],
				suggestedActions: [],
				description: 'Could not determine page type',
				metadata: {},
			};
		}
	}

	findSearchBox(elements: ElementInfo[]): ElementInfo | null {
		// Procurar por input com características de busca
		const searchPatterns = ['search', 'query', 'q', 'find', 'look'];
		
		for (const element of elements) {
			const name = (element.selector || '').toLowerCase();
			const placeholder = (element.placeholder || '').toLowerCase();
			const ariaLabel = (element.ariaLabel || '').toLowerCase();
			
			for (const pattern of searchPatterns) {
				if (name.includes(pattern) || placeholder.includes(pattern) || ariaLabel.includes(pattern)) {
					return element;
				}
			}
		}
		
		return null;
	}

	findLoginForm(forms: FormInfo[], elements: ElementInfo[]): FormInfo | null {
		for (const form of forms) {
			// Verificar se tem campos de usuário/email e senha
			const hasUserField = form.inputs.some(input => 
				this._isUserField(input)
			);
			
			const hasPasswordField = form.inputs.some(input =>
				input.type === 'password'
			);
			
			if (hasUserField && hasPasswordField) {
				return form;
			}
		}
		
		return null;
	}

	findForm(forms: FormInfo[]): FormInfo | null {
		// Retornar o primeiro formulário válido
		return forms.length > 0 ? forms[0] : null;
	}

	suggestNextSteps(pattern: PagePattern, elements: ElementInfo[]): SuggestedAction[] {
		const suggestions: SuggestedAction[] = [];

		switch (pattern.type) {
			case 'login': {
				const userField = elements.find(e => this._isUserField(e));
				const passwordField = elements.find(e => e.type === 'password');
				const submitBtn = elements.find(e => 
					e.tagName === 'button' && e.text.toLowerCase().includes('login')
				);

				if (userField) {
					suggestions.push({
						type: 'click',
						element: userField.selector,
						ref: userField.ref,
						reason: 'Focus on username/email field',
						confidence: 0.9,
					});
				}

				if (passwordField) {
					suggestions.push({
						type: 'click',
						element: passwordField.selector,
						ref: passwordField.ref,
						reason: 'Focus on password field',
						confidence: 0.9,
					});
				}

				if (submitBtn) {
					suggestions.push({
						type: 'click',
						element: submitBtn.selector,
						ref: submitBtn.ref,
						reason: 'Click login button',
						confidence: 0.95,
					});
				}
				break;
			}

			case 'search': {
				const searchBox = this.findSearchBox(elements);
				const searchBtn = elements.find(e =>
					e.tagName === 'button' && 
					(e.text.toLowerCase().includes('search') || 
					 e.ariaLabel.toLowerCase().includes('search'))
				);

				if (searchBox) {
					suggestions.push({
						type: 'click',
						element: searchBox.selector,
						ref: searchBox.ref,
						reason: 'Focus on search box',
						confidence: 0.95,
					});
				}

				if (searchBtn) {
					suggestions.push({
						type: 'click',
						element: searchBtn.selector,
						ref: searchBtn.ref,
						reason: 'Click search button',
						confidence: 0.9,
					});
				}
				break;
			}

			case 'form': {
				// Sugerir preenchimento do primeiro campo
				const firstInput = elements.find(e => 
					e.isVisible && (e.tagName === 'input' || e.tagName === 'select')
				);

				if (firstInput) {
					suggestions.push({
						type: 'click',
						element: firstInput.selector,
						ref: firstInput.ref,
						reason: 'Start filling form',
						confidence: 0.8,
					});
				}
				break;
			}

			case 'ecommerce': {
				// Sugerir busca ou browsing
				const searchBox = this.findSearchBox(elements);
				if (searchBox) {
					suggestions.push({
						type: 'click',
						element: searchBox.selector,
						ref: searchBox.ref,
						reason: 'Search for product',
						confidence: 0.85,
					});
				}
				break;
			}

			case 'dashboard': {
				// Sugerir exploração
				suggestions.push({
					type: 'screenshot',
					reason: 'Get overview of dashboard',
					confidence: 0.9,
				});
				break;
			}

			default:
				// Para padrões desconhecidos, sugerir screenshot
				suggestions.push({
					type: 'screenshot',
					reason: 'Analyze page structure',
					confidence: 0.7,
				});
		}

		return suggestions;
	}

	// Private methods

	private _detectLogin(snapshot: DOMSnapshot, indicators: string[]): number {
		let score = 0;

		// Procurar indicadores de página de login
		if (snapshot.title.toLowerCase().includes('login') || 
			snapshot.title.toLowerCase().includes('sign in')) {
			score += 0.3;
			indicators.push('Login in title');
		}

		if (snapshot.url.toLowerCase().includes('login')) {
			score += 0.2;
			indicators.push('Login in URL');
		}

		// Procurar por formulário de login
		const loginForm = this.findLoginForm(snapshot.forms, snapshot.elements);
		if (loginForm) {
			score += 0.5;
			indicators.push('Login form detected');
		}

		return Math.min(score, 1);
	}

	private _detectSearch(snapshot: DOMSnapshot, indicators: string[]): number {
		let score = 0;

		const searchBox = this.findSearchBox(snapshot.elements);
		if (searchBox) {
			score += 0.6;
			indicators.push('Search box found');
		}

		if (snapshot.elements.some(e => e.text.toLowerCase().includes('search results'))) {
			score += 0.3;
			indicators.push('Search results detected');
		}

		return Math.min(score, 1);
	}

	private _detectEcommerce(snapshot: DOMSnapshot, indicators: string[]): number {
		let score = 0;

		const ecommerceKeywords = ['product', 'price', 'add to cart', 'buy', 'shop', 'store'];
		const pageText = snapshot.elements.map(e => e.text.toLowerCase()).join(' ');

		for (const keyword of ecommerceKeywords) {
			if (pageText.includes(keyword)) {
				score += 0.1;
				indicators.push(`Ecommerce keyword: ${keyword}`);
			}
		}

		return Math.min(score, 1);
	}

	private _detectForm(snapshot: DOMSnapshot, indicators: string[]): number {
		let score = 0;

		if (snapshot.forms.length > 0) {
			score += 0.3;
			indicators.push(`${snapshot.forms.length} form(s) detected`);
		}

		if (snapshot.inputs.length > 2) {
			score += 0.3;
			indicators.push(`${snapshot.inputs.length} input fields detected`);
		}

		if (snapshot.buttons.some(b => b.text.toLowerCase().includes('submit'))) {
			score += 0.2;
			indicators.push('Submit button found');
		}

		return Math.min(score, 1);
	}

	private _detectDashboard(snapshot: DOMSnapshot, indicators: string[]): number {
		let score = 0;

		const dashboardKeywords = ['dashboard', 'overview', 'analytics', 'metrics', 'report'];

		for (const keyword of dashboardKeywords) {
			if (snapshot.title.toLowerCase().includes(keyword)) {
				score += 0.2;
				indicators.push(`Dashboard keyword in title: ${keyword}`);
			}
		}

		// Muitos elementos podem indicar dashboard
		if (snapshot.elements.length > 50) {
			score += 0.2;
			indicators.push('Complex page structure');
		}

		return Math.min(score, 1);
	}

	private _detectAPI(snapshot: DOMSnapshot, indicators: string[]): number {
		let score = 0;

		const apiKeywords = ['api', 'endpoint', 'json', 'swagger', 'openapi', 'graphql'];
		const pageText = snapshot.elements.map(e => e.text.toLowerCase()).join(' ');

		for (const keyword of apiKeywords) {
			if (pageText.includes(keyword) || snapshot.url.toLowerCase().includes(keyword)) {
				score += 0.25;
				indicators.push(`API keyword: ${keyword}`);
			}
		}

		return Math.min(score, 1);
	}

	private _isUserField(element: ElementInfo): boolean {
		const selector = (element.selector || '').toLowerCase();
		const placeholder = (element.placeholder || '').toLowerCase();
		const ariaLabel = (element.ariaLabel || '').toLowerCase();

		const userPatterns = ['user', 'email', 'login', 'username', 'account'];

		for (const pattern of userPatterns) {
			if (selector.includes(pattern) || placeholder.includes(pattern) || ariaLabel.includes(pattern)) {
				return true;
			}
		}

		return false;
	}

	private _getPatternDescription(type: PagePatternType): string {
		const descriptions: Record<PagePatternType, string> = {
			login: 'Login/Authentication page - typically has username and password fields',
			search: 'Search page - typically has a search box and results',
			form: 'Form page - has input fields and submission button',
			ecommerce: 'E-commerce page - typically for shopping',
			dashboard: 'Dashboard/Analytics page - provides overview and metrics',
			documentation: 'Documentation page - contains API or product documentation',
			api: 'API documentation or endpoint',
			unknown: 'Unknown page type',
		};

		return descriptions[type];
	}
}
