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
	| 'social_feed'
	| 'chat_interface'
	| 'email_compose'
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
			// Verificação defensiva: garantir que o snapshot é válido
			if (!snapshot || !snapshot.elements || !Array.isArray(snapshot.elements)) {
				this.logService.warn('[PagePatternDetector] Invalid or empty snapshot provided');
				return {
					type: 'unknown',
					confidence: 0,
					indicators: ['Invalid snapshot data'],
					suggestedActions: [],
					description: 'Invalid or empty page data',
					metadata: { isValid: false },
				};
			}

			const indicators: string[] = [];
			let type: PagePatternType = 'unknown';
			let confidence = 0;

			// Verificar cada tipo de padrão
			const loginPattern = this._detectLogin(snapshot, indicators);
			const searchPattern = this._detectSearch(snapshot, indicators);
			const ecommercePattern = this._detectEcommerce(snapshot, indicators);
			const formPattern = this._detectForm(snapshot, indicators);
			const dashboardPattern = this._detectDashboard(snapshot, indicators);
			const socialPattern = this._detectSocialFeed(snapshot, indicators);
			const chatPattern = this._detectChatInterface(snapshot, indicators);
			const emailPattern = this._detectEmailCompose(snapshot, indicators);
			const apiPattern = this._detectAPI(snapshot, indicators);

			// Determinar padrão com maior confiança
			const patterns = [
				{ type: 'login' as PagePatternType, confidence: loginPattern },
				{ type: 'search' as PagePatternType, confidence: searchPattern },
				{ type: 'ecommerce' as PagePatternType, confidence: ecommercePattern },
				{ type: 'form' as PagePatternType, confidence: formPattern },
				{ type: 'dashboard' as PagePatternType, confidence: dashboardPattern },
				{ type: 'social_feed' as PagePatternType, confidence: socialPattern },
				{ type: 'chat_interface' as PagePatternType, confidence: chatPattern },
				{ type: 'email_compose' as PagePatternType, confidence: emailPattern },
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
					formCount: (snapshot.forms || []).length,
					buttonCount: (snapshot.buttons || []).length,
					inputCount: (snapshot.inputs || []).length,
					linkCount: (snapshot.links || []).length,
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
		// Verificação defensiva
		if (!elements || !Array.isArray(elements)) {
			return null;
		}

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
		// Verificação defensiva
		if (!forms || !Array.isArray(forms) || !elements || !Array.isArray(elements)) {
			return null;
		}

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
		if (forms && Array.isArray(forms) && forms.length > 0) {
			return forms[0];
		}
		return null;
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

			case 'social_feed': {
				const postBox = elements.find(e => 
					(e.placeholder || '').toLowerCase().includes('thinking') || 
					(e.placeholder || '').toLowerCase().includes('pensando') ||
					(e.ariaLabel || '').toLowerCase().includes('post')
				);
				if (postBox) {
					suggestions.push({
						type: 'click',
						element: postBox.selector,
						ref: postBox.ref,
						reason: 'Click on post creation box',
						confidence: 0.95,
					});
				}
				break;
			}

			case 'chat_interface': {
				const messageBox = elements.find(e => 
					(e.placeholder || '').toLowerCase().includes('message') || 
					(e.placeholder || '').toLowerCase().includes('mensagem')
				);
				if (messageBox) {
					suggestions.push({
						type: 'type',
						element: messageBox.selector,
						ref: messageBox.ref,
						reason: 'Type a new message',
						confidence: 0.9,
					});
				}
				break;
			}

			case 'email_compose': {
				const toField = elements.find(e => (e.ariaLabel || '').toLowerCase().includes('to') || (e.placeholder || '').toLowerCase().includes('para'));
				if (toField) {
					suggestions.push({
						type: 'type',
						element: toField.selector,
						ref: toField.ref,
						reason: 'Fill recipient email',
						confidence: 0.9,
					});
				}
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

		// Procurar por formulário de login (safe array fallback)
		const loginForm = this.findLoginForm(snapshot.forms || [], snapshot.elements);
		if (loginForm) {
			score += 0.5;
			indicators.push('Login form detected');
		}

		return Math.min(score, 1);
	}

	private _detectSearch(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot || !snapshot.elements) return 0;
		let score = 0;

		const elements = snapshot.elements || [];

		const searchBox = this.findSearchBox(elements);
		if (searchBox) {
			score += 0.6;
			indicators.push('Search box found');
		}

		if (elements.some(e => (e.text || '').toLowerCase().includes('search results'))) {
			score += 0.3;
			indicators.push('Search results detected');
		}

		return Math.min(score, 1);
	}

	private _detectEcommerce(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot || !snapshot.elements) return 0;
		let score = 0;

		const ecommerceKeywords = ['product', 'price', 'add to cart', 'buy', 'shop', 'store'];
		const pageText = (snapshot.elements || []).map(e => (e.text || '').toLowerCase()).join(' ');

		for (const keyword of ecommerceKeywords) {
			if (pageText.includes(keyword)) {
				score += 0.1;
				indicators.push(`Ecommerce keyword: ${keyword}`);
			}
		}

		return Math.min(score, 1);
	}

	private _detectForm(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot) return 0;
		let score = 0;

		const forms = snapshot.forms || [];
		const inputs = snapshot.inputs || [];
		const buttons = snapshot.buttons || [];

		if (forms.length > 0) {
			score += 0.3;
			indicators.push(`${forms.length} form(s) detected`);
		}

		if (inputs.length > 2) {
			score += 0.3;
			indicators.push(`${inputs.length} input fields detected`);
		}

		if (buttons.some(b => (b.text || '').toLowerCase().includes('submit'))) {
			score += 0.2;
			indicators.push('Submit button found');
		}

		return Math.min(score, 1);
	}

	private _detectDashboard(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot) return 0;
		let score = 0;

		const dashboardKeywords = ['dashboard', 'overview', 'analytics', 'metrics', 'report'];

		for (const keyword of dashboardKeywords) {
			if ((snapshot.title || '').toLowerCase().includes(keyword)) {
				score += 0.2;
				indicators.push(`Dashboard keyword in title: ${keyword}`);
			}
		}

		// Muitos elementos podem indicar dashboard
		if ((snapshot.elements || []).length > 50) {
			score += 0.2;
			indicators.push('Complex page structure');
		}

		return Math.min(score, 1);
	}

	private _detectAPI(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot || !snapshot.elements) return 0;
		let score = 0;

		const apiKeywords = ['api', 'endpoint', 'json', 'swagger', 'openapi', 'graphql'];
		const pageText = (snapshot.elements || []).map(e => (e.text || '').toLowerCase()).join(' ');

		for (const keyword of apiKeywords) {
			if (pageText.includes(keyword) || (snapshot.url || '').toLowerCase().includes(keyword)) {
				score += 0.25;
				indicators.push(`API keyword: ${keyword}`);
			}
		}

		return Math.min(score, 1);
	}

	private _detectSocialFeed(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot || !snapshot.elements) return 0;
		let score = 0;

		const socialKeywords = ['facebook', 'linkedin', 'twitter', 'instagram', 'feed', 'post', 'timeline'];
		const url = (snapshot.url || '').toLowerCase();

		for (const keyword of socialKeywords) {
			if (url.includes(keyword)) {
				score += 0.4;
				indicators.push(`Social platform detected in URL: ${keyword}`);
			}
		}

		const postIndicators = ['thinking', 'pensando', 'share', 'compartilhar'];
		const elements = snapshot.elements || [];
		
		for (const element of elements) {
			const placeholder = (element.placeholder || '').toLowerCase();
			if (postIndicators.some(p => placeholder.includes(p))) {
				score += 0.5;
				indicators.push('Post creation box detected');
				break;
			}
		}

		return Math.min(score, 1);
	}

	private _detectChatInterface(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot || !snapshot.elements) return 0;
		let score = 0;

		const chatKeywords = ['whatsapp', 'messenger', 'telegram', 'slack', 'discord', 'chat'];
		const url = (snapshot.url || '').toLowerCase();

		for (const keyword of chatKeywords) {
			if (url.includes(keyword)) {
				score += 0.5;
				indicators.push(`Chat platform detected in URL: ${keyword}`);
			}
		}

		const elements = snapshot.elements || [];
		const messageBox = elements.find(e => 
			(e.placeholder || '').toLowerCase().includes('message') || 
			(e.placeholder || '').toLowerCase().includes('mensagem')
		);

		if (messageBox) {
			score += 0.4;
			indicators.push('Chat input field detected');
		}

		return Math.min(score, 1);
	}

	private _detectEmailCompose(snapshot: DOMSnapshot, indicators: string[]): number {
		if (!snapshot || !snapshot.elements) return 0;
		let score = 0;

		const emailKeywords = ['mail', 'outlook', 'gmail', 'compose', 'escrever'];
		const url = (snapshot.url || '').toLowerCase();

		for (const keyword of emailKeywords) {
			if (url.includes(keyword)) {
				score += 0.3;
				indicators.push(`Email platform detected in URL: ${keyword}`);
			}
		}

		const elements = snapshot.elements || [];
		const hasTo = elements.some(e => (e.ariaLabel || '').toLowerCase().includes('to') || (e.placeholder || '').toLowerCase().includes('para'));
		const hasSubject = elements.some(e => (e.ariaLabel || '').toLowerCase().includes('subject') || (e.placeholder || '').toLowerCase().includes('assunto'));

		if (hasTo && hasSubject) {
			score += 0.6;
			indicators.push('Email composition fields detected');
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
			social_feed: 'Social media feed - typically for browsing and posting updates',
			chat_interface: 'Chat or messaging interface',
			email_compose: 'Email composition interface',
			documentation: 'Documentation page - contains API or product documentation',
			api: 'API documentation or endpoint',
			unknown: 'Unknown page type',
		};

		return descriptions[type];
	}
}
