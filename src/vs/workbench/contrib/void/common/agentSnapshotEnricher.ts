/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../platform/log/common/log.js';

/**
 * Enriquece snapshots de navegador com análise estruturada para o agente
 * Converte dados brutos em insights acionáveis
 */

export interface ElementReference {
	ref: string;
	type: 'button' | 'link' | 'input' | 'select' | 'form' | 'heading' | 'text' | 'other';
	text?: string;
	label?: string;
	name?: string;
	placeholder?: string;
	role?: string;
	ariaLabel?: string;
	visible: boolean;
	clickable: boolean;
	index: number; // Índice para referência do agente
}

export interface PageAnalysis {
	url: string;
	title: string;
	hasError: boolean;
	errorMessages: string[];
	isLoading: boolean;
	hasForm: boolean;
	formFields: ElementReference[];
	interactiveElements: ElementReference[];
	suggestedActions: string[];
	pageType: 'login' | 'search' | 'form' | 'content' | 'unknown';
	contentSummary: string;
}

export class AgentSnapshotEnricher {
	constructor(
		private readonly logService: ILogService
	) { }

	/**
	 * Enriquece um snapshot de acessibilidade com análise estruturada
	 */
	enrichAccessibilitySnapshot(
		accessibilityContent: string,
		url: string,
		title: string,
		previousAnalysis?: PageAnalysis
	): PageAnalysis {
		try {
			const lines = accessibilityContent.split('\n').slice(0, 100); // Primeiras 100 linhas para análise

			const analysis: PageAnalysis = {
				url,
				title,
				hasError: false,
				errorMessages: [],
				isLoading: false,
				hasForm: false,
				formFields: [],
				interactiveElements: [],
				suggestedActions: [],
				pageType: 'unknown',
				contentSummary: ''
			};

			// Detectar erros
			const errorPatterns = [
				/error|erro/i,
				/failed|falhou/i,
				/not found|não encontrado/i,
				/exception/i,
				/invalid/i
			];

			for (const line of lines) {
				for (const pattern of errorPatterns) {
					if (pattern.test(line)) {
						analysis.hasError = true;
						analysis.errorMessages.push(line.trim());
					}
				}
			}

			// Detectar elementos interativos
			let elementIndex = 0;
			const elementPatterns = [
				{ regex: /button|botão/i, type: 'button' as const },
				{ regex: /link|href/i, type: 'link' as const },
				{ regex: /input|campo/i, type: 'input' as const },
				{ regex: /select|combobox|dropdown/i, type: 'select' as const },
				{ regex: /form|formulário/i, type: 'form' as const },
				{ regex: /h[1-6]|heading|título/i, type: 'heading' as const }
			];

			for (const line of lines) {
				for (const pattern of elementPatterns) {
					if (pattern.regex.test(line)) {
						const text = line.replace(/^\s*[-*]\s+/, '').trim().substring(0, 50);
						if (text.length > 0) {
							analysis.interactiveElements.push({
								ref: `elem-${elementIndex}`,
								type: pattern.type,
								text: text,
								visible: true,
								clickable: pattern.type === 'button' || pattern.type === 'link',
								index: elementIndex
							});
							elementIndex++;

							if (pattern.type === 'form' || pattern.type === 'input') {
								analysis.hasForm = true;
								analysis.formFields.push({
									ref: `field-${analysis.formFields.length}`,
									type: pattern.type,
									text,
									visible: true,
									clickable: false,
									index: analysis.formFields.length
								});
							}
						}
					}
				}
			}

			// Detectar tipo de página
			const contentLower = accessibilityContent.toLowerCase();
			if (contentLower.includes('login') || contentLower.includes('password') || contentLower.includes('senha')) {
				analysis.pageType = 'login';
				analysis.suggestedActions.push('Enter credentials and login');
			} else if (contentLower.includes('search') || contentLower.includes('buscar')) {
				analysis.pageType = 'search';
				analysis.suggestedActions.push('Enter search query');
			} else if (analysis.hasForm) {
				analysis.pageType = 'form';
				analysis.suggestedActions.push('Fill out the form');
			} else {
				analysis.pageType = 'content';
				analysis.suggestedActions.push('Review page content');
			}

			// Detectar carregamento
			analysis.isLoading = /loading|carregando|please wait|aguarde/i.test(accessibilityContent);

			// Gerar resumo
			analysis.contentSummary = this._generateContentSummary(
				accessibilityContent,
				analysis.interactiveElements.slice(0, 5)
			);

			this.logService.debug(
				`[AgentSnapshotEnricher] Enriched snapshot: type=${analysis.pageType}, ` +
				`elements=${analysis.interactiveElements.length}, errors=${analysis.errorMessages.length}`
			);

			return analysis;
		} catch (error) {
			this.logService.error(`[AgentSnapshotEnricher] Error enriching snapshot: ${error}`);
			return {
				url,
				title,
				hasError: true,
				errorMessages: [`Failed to analyze snapshot: ${error}`],
				isLoading: false,
				hasForm: false,
				formFields: [],
				interactiveElements: [],
				suggestedActions: [],
				pageType: 'unknown',
				contentSummary: ''
			};
		}
	}

	/**
	 * Gera um resumo textual do conteúdo para o agente
	 */
	private _generateContentSummary(content: string, elements: ElementReference[]): string {
		const lines = content.split('\n').filter(l => l.trim().length > 0).slice(0, 10);
		const summary = lines.join(' | ').substring(0, 200);

		const elementDescriptions = elements
			.filter(e => e.clickable || e.text)
			.map(e => `• ${e.type}: ${e.text}`)
			.join('\n');

		return `${summary}\n\nKey Elements:\n${elementDescriptions}`;
	}

	/**
	 * Compara duas análises para detectar mudanças
	 */
	detectChanges(prev: PageAnalysis | undefined, curr: PageAnalysis): string[] {
		if (!prev) {
			return [`New page loaded: ${curr.title}`];
		}

		const changes: string[] = [];

		if (prev.url !== curr.url) {
			changes.push(`Navigation detected: ${prev.url} → ${curr.url}`);
		}

		if (prev.hasError !== curr.hasError) {
			changes.push(`Error state changed: ${curr.hasError ? 'ERROR APPEARED' : 'error resolved'}`);
		}

		if (prev.pageType !== curr.pageType) {
			changes.push(`Page type changed: ${prev.pageType} → ${curr.pageType}`);
		}

		if (curr.errorMessages.length > 0) {
			changes.push(`Page has errors: ${curr.errorMessages.slice(0, 2).join('; ')}`);
		}

		if (curr.isLoading) {
			changes.push('Page is currently loading...');
		}

		return changes;
	}

	/**
	 * Formata análise para apresentação ao agente
	 */
	formatForAgent(analysis: PageAnalysis): string {
		return `
=== PAGE ANALYSIS ===
URL: ${analysis.url}
Title: ${analysis.title}
Type: ${analysis.pageType}
Status: ${analysis.isLoading ? 'LOADING' : analysis.hasError ? 'ERROR' : 'OK'}

Interactive Elements (${analysis.interactiveElements.length}):
${analysis.interactiveElements.slice(0, 10)
			.map(e => `  [${e.ref}] ${e.type}: ${e.text || '(no text)'}`)
			.join('\n')}

${analysis.errorMessages.length > 0 ? `Errors:\n${analysis.errorMessages.map(e => `  • ${e}`).join('\n')}\n` : ''}

Suggested Actions:
${analysis.suggestedActions.map(a => `  • ${a}`).join('\n')}
`;
	}
}
