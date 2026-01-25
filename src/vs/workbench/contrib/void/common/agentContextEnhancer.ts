/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

export interface ElementReference {
	ref: string;
	selector: string;
	text: string;
	type: string;
	isInteractive: boolean;
	isVisible: boolean;
	ariaLabel?: string;
	placeholder?: string;
}

export interface PageContext {
	url: string;
	title: string;
	hasError: boolean;
	errorMessages: string[];
	interactiveElements: ElementReference[];
	suggestedActions: SuggestedAction[];
	navigationHints: NavigationHint[];
}

export interface SuggestedAction {
	priority: 'high' | 'medium' | 'low';
	action: string;
	reasoning: string;
	confidence: number; // 0-1
}

export interface NavigationHint {
	type: 'breadcrumb' | 'next' | 'previous' | 'related';
	target: string;
	label: string;
}

export interface BrowserContextMessage {
	type: 'context_update';
	context: PageContext;
	timestamp: number;
	changeDetected: boolean;
}

export const IAgentContextEnhancer = createDecorator<IAgentContextEnhancer>('AgentContextEnhancer');

export interface IAgentContextEnhancer {
	readonly _serviceBrand: undefined;

	/**
	 * Analisa snapshot e retorna contexto enriquecido
	 */
	analyzeSnapshot(
		url: string,
		title: string,
		accessibilityContent: string,
		previousContext?: PageContext
	): PageContext;

	/**
	 * Formata contexto como mensagem para incluir no chat
	 */
	formatContextMessage(context: PageContext): string;

	/**
	 * Detecta mudanças entre dois contextos
	 */
	detectChanges(prev: PageContext, curr: PageContext): string[];
}

export class AgentContextEnhancerService extends Disposable implements IAgentContextEnhancer {
	_serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	/**
	 * Analisa snapshot e retorna contexto enriquecido
	 */
	analyzeSnapshot(
		url: string,
		title: string,
		accessibilityContent: string,
		previousContext?: PageContext
	): PageContext {
		try {
			const interactiveElements = this.extractInteractiveElements(accessibilityContent);
			const errorMessages = this.detectErrorMessages(accessibilityContent);
			const suggestedActions = this.generateSuggestions(
				url,
				title,
				interactiveElements,
				errorMessages,
				previousContext
			);
			const navigationHints = this.extractNavigationHints(accessibilityContent, url);

			const context: PageContext = {
				url,
				title,
				hasError: errorMessages.length > 0,
				errorMessages,
				interactiveElements,
				suggestedActions,
				navigationHints
			};

			this.logService.debug(`[AgentContextEnhancer] Analyzed page: ${url} with ${interactiveElements.length} interactive elements`);

			return context;
		} catch (error) {
			this.logService.error(`[AgentContextEnhancer] Error analyzing snapshot: ${error}`);
			
			return {
				url,
				title,
				hasError: true,
				errorMessages: [String(error)],
				interactiveElements: [],
				suggestedActions: [],
				navigationHints: [],
			};
		}
	}

	/**
	 * Extrai elementos interativos da árvore de acessibilidade
	 */
	private extractInteractiveElements(
		accessibilityContent: string
	): ElementReference[] {
		const elements: ElementReference[] = [];
		
		// Buscar por padrões comuns em árvore de acessibilidade
		const buttonPattern = /button:\s*"([^"]+)"/gi;
		const linkPattern = /link:\s*"([^"]+)"/gi;
		const inputPattern = /textbox|searchbox|combobox:\s*"([^"]*)"/gi;
		
		// Botões
		let match;
		while ((match = buttonPattern.exec(accessibilityContent)) !== null) {
			elements.push({
				ref: `btn-${elements.length}`,
				selector: match[1],
				text: match[1],
				type: 'button',
				isInteractive: true,
				isVisible: true
			});
		}
		
		// Links
		while ((match = linkPattern.exec(accessibilityContent)) !== null) {
			elements.push({
				ref: `link-${elements.length}`,
				selector: match[1],
				text: match[1],
				type: 'link',
				isInteractive: true,
				isVisible: true
			});
		}
		
		// Inputs
		while ((match = inputPattern.exec(accessibilityContent)) !== null) {
			const text = match[1] || 'input field';
			elements.push({
				ref: `input-${elements.length}`,
				selector: `input[placeholder="${text}"]`,
				text: text,
				type: 'input',
				isInteractive: true,
				isVisible: true,
				placeholder: text
			});
		}

		// Limitar a 15 elementos mais relevantes
		return elements.slice(0, 15);
	}

	/**
	 * Detecta mensagens de erro na página
	 */
	private detectErrorMessages(accessibilityContent: string): string[] {
		const errors: string[] = [];
		
		// Padrões de erro comuns
		const errorPatterns = [
			/error[:\s]+([^\.!\n]+)/gi,
			/failed[:\s]+([^\.!\n]+)/gi,
			/invalid[:\s]+([^\.!\n]+)/gi,
			/required[:\s]+([^\.!\n]+)/gi,
			/not found/gi,
			/page not found/gi,
			/404/g,
			/500/g
		];

		for (const pattern of errorPatterns) {
			let match;
			while ((match = pattern.exec(accessibilityContent)) !== null) {
				const error = match[1] || match[0];
				if (!errors.includes(error)) {
					errors.push(error.trim());
				}
			}
		}

		return errors.slice(0, 5); // Máximo 5 erros
	}

	/**
	 * Gera sugestões de ações para o agente
	 */
	private generateSuggestions(
		url: string,
		title: string,
		elements: ElementReference[],
		errors: string[],
		previousContext?: PageContext
	): SuggestedAction[] {
		const suggestions: SuggestedAction[] = [];

		// Se há erros, sugerir retry ou voltar
		if (errors.length > 0) {
			suggestions.push({
				priority: 'high',
				action: 'reload_page',
				reasoning: `Página contém erros: ${errors.join(', ')}`,
				confidence: 0.8
			});

			suggestions.push({
				priority: 'high',
				action: 'go_back',
				reasoning: 'Voltar para página anterior após erro',
				confidence: 0.7
			});
		}

		// Se page mudou, analisar novo contexto
		if (previousContext && previousContext.url !== url) {
			suggestions.push({
				priority: 'medium',
				action: 'analyze_new_page',
				reasoning: `Navegação detectada para ${url}`,
				confidence: 0.9
			});
		}

		// Sugerir interações com elementos visíveis
		const buttons = elements.filter(e => e.type === 'button');
		const inputs = elements.filter(e => e.type === 'input');

		if (inputs.length > 0) {
			suggestions.push({
				priority: 'medium',
				action: `fill_input`,
				reasoning: `Página contém ${inputs.length} campo(s) de entrada`,
				confidence: 0.6
			});
		}

		if (buttons.length > 0) {
			const mainButton = buttons[0];
			suggestions.push({
				priority: 'low',
				action: `click_button`,
				reasoning: `Botão principal disponível: "${mainButton.text}"`,
				confidence: 0.5
			});
		}

		return suggestions.slice(0, 5); // Máximo 5 sugestões
	}

	/**
	 * Extrai hints de navegação (breadcrumbs, próxima página, etc)
	 */
	private extractNavigationHints(
		accessibilityContent: string,
		currentUrl: string
	): NavigationHint[] {
		const hints: NavigationHint[] = [];

		// Detectar breadcrumbs
		if (accessibilityContent.includes('breadcrumb') || accessibilityContent.includes('Home')) {
			hints.push({
				type: 'breadcrumb',
				target: '/',
				label: 'Voltar ao início'
			});
		}

		// Detectar navegação next/previous
		if (accessibilityContent.includes('Next') || accessibilityContent.includes('Próximo')) {
			hints.push({
				type: 'next',
				target: 'next_page',
				label: 'Ir para próxima página'
			});
		}

		if (accessibilityContent.includes('Previous') || accessibilityContent.includes('Anterior')) {
			hints.push({
				type: 'previous',
				target: 'previous_page',
				label: 'Voltar para página anterior'
			});
		}

		return hints;
	}

	/**
	 * Formata contexto como mensagem para incluir no chat
	 */
	formatContextMessage(context: PageContext): string {
		let message = `## Análise de Página\n\n`;
		message += `**URL**: ${context.url}\n`;
		message += `**Título**: ${context.title}\n\n`;

		if (context.hasError) {
			message += `⚠️ **Erros Detectados**:\n`;
			context.errorMessages.forEach(err => {
				message += `- ${err}\n`;
			});
			message += `\n`;
		}

		if (context.interactiveElements.length > 0) {
			message += `🔘 **Elementos Interativos** (${context.interactiveElements.length} encontrados):\n`;
			context.interactiveElements.slice(0, 5).forEach(el => {
				message += `- [${el.type}] ${el.text} (${el.ref})\n`;
			});
			if (context.interactiveElements.length > 5) {
				message += `- ... e ${context.interactiveElements.length - 5} mais\n`;
			}
			message += `\n`;
		}

		if (context.suggestedActions.length > 0) {
			message += `💡 **Ações Sugeridas**:\n`;
			context.suggestedActions.slice(0, 3).forEach(action => {
				message += `- **${action.action}** (${(action.confidence * 100).toFixed(0)}%): ${action.reasoning}\n`;
			});
			message += `\n`;
		}

		if (context.navigationHints.length > 0) {
			message += `🧭 **Dicas de Navegação**:\n`;
			context.navigationHints.forEach(hint => {
				message += `- ${hint.label}\n`;
			});
		}

		return message;
	}

	/**
	 * Detecta se houve mudança significativa na página
	 */
	detectChanges(prev: PageContext, curr: PageContext): string[] {
		const changes: string[] = [];

		if (prev.url !== curr.url) {
			changes.push(`Navegação: ${prev.url} → ${curr.url}`);
		}

		if (prev.hasError !== curr.hasError) {
			if (curr.hasError) {
				changes.push(`Erro detectado: ${curr.errorMessages.join(', ')}`);
			} else {
				changes.push('Erros foram resolvidos');
			}
		}

		if (prev.interactiveElements.length !== curr.interactiveElements.length) {
			changes.push(
				`Elementos mudaram: ${prev.interactiveElements.length} → ${curr.interactiveElements.length}`
			);
		}

		return changes;
	}
}
