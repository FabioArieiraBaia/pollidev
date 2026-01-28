/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

/**
 * Informações estruturadas sobre um elemento HTML
 */
export interface ElementInfo {
	ref: string;                    // ID único gerado para este elemento
	selector: string;               // CSS selector principal
	tagName: string;                // HTML tag (div, button, input, etc)
	role: string;                   // ARIA role
	ariaLabel: string;              // Accessibility label
	text: string;                   // Texto visível (primeiros 100 caracteres)
	isClickable: boolean;            // Pode ser clicado?
	isVisible: boolean;              // Está visível na página?
	isFocusable: boolean;            // Pode receber foco?
	type?: string;                   // input type, button type, etc
	placeholder?: string;            // placeholder para inputs
	value?: string;                  // Valor atual (para inputs/textarea)
	options?: string[];              // Opções (para selects)
	disabled?: boolean;              // Está desabilitado?
	required?: boolean;              // Campo obrigatório?
	parent?: string;                 // ref do elemento pai
	children?: string[];             // refs dos filhos
	classList?: string[];            // CSS classes aplicadas
	boundingBox?: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

/**
 * Informações sobre um formulário
 */
export interface FormInfo {
	ref: string;
	tagName: string;
	selector: string;
	method?: string;
	action?: string;
	inputs: ElementInfo[];
	buttons: ElementInfo[];
	ariaLabel?: string;
}

/**
 * Snapshot estruturado do DOM
 */
export interface DOMSnapshot {
	url: string;
	title: string;
	timestamp: number;
	hash: string;                   // Hash do DOM para detectar mudanças
	isLoading: boolean;             // Página em carregamento?
	elements: ElementInfo[];        // Todos os elementos
	forms: FormInfo[];              // Formulários detectados
	links: ElementInfo[];           // Links (âncoras)
	buttons: ElementInfo[];         // Botões
	inputs: ElementInfo[];          // Campos de entrada
	accessibility_tree: string;     // Árvore de acessibilidade em texto
	errors: string[];               // Mensagens de erro detectadas
	warnings: string[];             // Avisos detectados
}

export const IDOMAnalysisService = createDecorator<IDOMAnalysisService>('DOMAnalysisService');

export interface IDOMAnalysisService {
	readonly _serviceBrand: undefined;
	/**
	 * Analisa o DOM da página e retorna informações estruturadas
	 */
	analyzeDOMStructure(htmlContent: string, url: string): DOMSnapshot;
	/**
	 * Converte um snapshot JSON do navegador em um DOMSnapshot estruturado
	 */
	processBrowserSnapshot(jsonSnapshot: any): DOMSnapshot;
	/**
	 * Encontra um elemento pelo selector CSS
	 */
	findElementBySelector(elements: ElementInfo[], selector: string): ElementInfo | null;
	/**
	 * Encontra elementos por texto visível
	 */
	findElementsByText(elements: ElementInfo[], text: string, fuzzy?: boolean): ElementInfo[];
	/**
	 * Encontra elementos clicáveis na página
	 */
	getClickableElements(elements: ElementInfo[]): ElementInfo[];
	/**
	 * Gera um hash do DOM para detectar mudanças
	 */
	generateDOMHash(snapshot: DOMSnapshot): string;
	/**
	 * Deteta mudanças entre dois snapshots
	 */
	detectChanges(prev: DOMSnapshot, curr: DOMSnapshot): string[];
	/**
	 * Constrói a árvore de acessibilidade
	 */
	buildAccessibilityTree(elements: ElementInfo[]): string;
}

export class DOMAnalysisService extends Disposable implements IDOMAnalysisService {
	_serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	analyzeDOMStructure(htmlContent: string, url: string): DOMSnapshot {
		try {
			this.logService.debug('[DOMAnalysisService] Starting DOM analysis from HTML...');
			
			const startTime = Date.now();
			const elements: ElementInfo[] = [];
			const errors: string[] = [];
			const warnings: string[] = [];
			
			const snapshot: DOMSnapshot = {
				url,
				title: this._extractTitle(htmlContent),
				timestamp: Date.now(),
				hash: this._generateHash(htmlContent),
				isLoading: this._detectLoading(htmlContent),
				elements,
				forms: [],
				links: [],
				buttons: [],
				inputs: [],
				accessibility_tree: '',
				errors,
				warnings,
			};

			// Processar página (método legado via Regex)
			this._extractElements(htmlContent, snapshot);
			snapshot.accessibility_tree = this.buildAccessibilityTree(snapshot.elements);

			const elapsed = Date.now() - startTime;
			this.logService.info(`[DOMAnalysisService] DOM analysis completed in ${elapsed}ms. Found ${elements.length} elements.`);

			return snapshot;
		} catch (error) {
			this.logService.error(`[DOMAnalysisService] Error analyzing DOM: ${error}`);
			return this._emptySnapshot(url, String(error));
		}
	}

	processBrowserSnapshot(jsonSnapshot: any): DOMSnapshot {
		try {
			if (!jsonSnapshot) throw new Error('Snapshot data is empty');

			const url = jsonSnapshot.url || '';
			const elements: ElementInfo[] = [];
			const snapshot: DOMSnapshot = {
				url,
				title: jsonSnapshot.title || 'Untitled',
				timestamp: jsonSnapshot.timestamp || Date.now(),
				hash: '',
				isLoading: false,
				elements,
				forms: [],
				links: [],
				buttons: [],
				inputs: [],
				accessibility_tree: '',
				errors: [],
				warnings: [],
			};

			// Função recursiva para achatar a árvore em uma lista plana de elementos
			const flatten = (node: any, parentRef?: string) => {
				if (!node) return;

				const element: ElementInfo = {
					ref: node.ref || `gen-${elements.length}`,
					selector: node.ref ? `[data-void-ref="${node.ref}"]` : '',
					tagName: node.role || 'div',
					role: node.role || 'generic',
					ariaLabel: node.name || '',
					text: node.name || '',
					isClickable: !!node.isInteractive,
					isVisible: true,
					isFocusable: !!node.isInteractive,
					parent: parentRef,
				};

				elements.push(element);

				// Categorizar
				if (element.isClickable) {
					if (element.role === 'link' || element.tagName === 'a') snapshot.links.push(element);
					else if (element.role === 'button' || element.tagName === 'button') snapshot.buttons.push(element);
					else if (element.role === 'textbox' || element.tagName === 'input') snapshot.inputs.push(element);
				}

				if (node.children && Array.isArray(node.children)) {
					node.children.forEach((child: any) => flatten(child, element.ref));
				}
			};

			flatten(jsonSnapshot.tree);
			
			snapshot.hash = this._generateHash(JSON.stringify(elements));
			snapshot.accessibility_tree = this.buildAccessibilityTree(elements);

			return snapshot;
		} catch (error) {
			this.logService.error(`[DOMAnalysisService] Error processing JSON snapshot: ${error}`);
			return this._emptySnapshot('', String(error));
		}
	}

	private _emptySnapshot(url: string, error?: string): DOMSnapshot {
		return {
			url,
			title: 'Error',
			timestamp: Date.now(),
			hash: '',
			isLoading: false,
			elements: [],
			forms: [],
			links: [],
			buttons: [],
			inputs: [],
			accessibility_tree: '',
			errors: error ? [error] : [],
			warnings: [],
		};
	}

	findElementBySelector(elements: ElementInfo[], selector: string): ElementInfo | null {
		return elements.find(el => el.selector === selector) || null;
	}

	findElementsByText(elements: ElementInfo[], text: string, fuzzy: boolean = false): ElementInfo[] {
		const searchText = text.toLowerCase();
		
		if (fuzzy) {
			// Fuzzy matching: encontra elementos que contenham parte do texto
			return elements.filter(el => 
				el.text.toLowerCase().includes(searchText)
			);
		} else {
			// Exact matching
			return elements.filter(el => 
				el.text.toLowerCase() === searchText
			);
		}
	}

	getClickableElements(elements: ElementInfo[]): ElementInfo[] {
		return elements.filter(el => el.isClickable && el.isVisible);
	}

	generateDOMHash(snapshot: DOMSnapshot): string {
		// Hash baseado em quantidade e tipos de elementos
		const elementCounts = {
			forms: snapshot.forms.length,
			buttons: snapshot.buttons.length,
			inputs: snapshot.inputs.length,
			links: snapshot.links.length,
		};
		
		const hashString = JSON.stringify(elementCounts) + snapshot.url;
		return this._simpleHash(hashString);
	}

	detectChanges(prev: DOMSnapshot, curr: DOMSnapshot): string[] {
		const changes: string[] = [];
		
		if (prev.hash !== curr.hash) {
			changes.push('DOM structure changed');
		}
		
		if (prev.url !== curr.url) {
			changes.push(`URL changed from ${prev.url} to ${curr.url}`);
		}
		
		if (prev.isLoading !== curr.isLoading) {
			changes.push(curr.isLoading ? 'Page started loading' : 'Page finished loading');
		}
		
		if (prev.elements.length !== curr.elements.length) {
			changes.push(`Element count changed from ${prev.elements.length} to ${curr.elements.length}`);
		}
		
		if (curr.errors.length > prev.errors.length) {
			const newErrors = curr.errors.slice(prev.errors.length);
			changes.push(`New errors detected: ${newErrors.join(', ')}`);
		}
		
		return changes;
	}

	buildAccessibilityTree(elements: ElementInfo[]): string {
		// Construir árvore hierárquica simples
		const treeLines = elements.map((el, idx) => {
			const indent = '  '.repeat(el.parent ? 1 : 0);
			const role = el.role ? `[${el.role}]` : '';
			const text = el.text ? ` "${el.text.substring(0, 50)}"` : '';
			const disabled = el.disabled ? ' (disabled)' : '';
			
			return `${indent}${idx}. ${el.tagName}${role}${text}${disabled}`;
		});
		
		return treeLines.join('\n');
	}

	// Private methods

	private _extractTitle(htmlContent: string): string {
		const match = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
		return match ? match[1] : 'Untitled';
	}

	private _detectLoading(htmlContent: string): boolean {
		const loadingPatterns = [
			'loading',
			'spinner',
			'skeleton',
			'progress-bar',
			'data-loading',
		];
		
		return loadingPatterns.some(pattern => 
			htmlContent.toLowerCase().includes(pattern)
		);
	}

	private _extractElements(htmlContent: string, snapshot: DOMSnapshot): void {
		// Implementação simplificada - em produção usar parser HTML real
		// Extrair elementos básicos
		const regex = /<(button|a|input|select|form)\b[^>]*>/gi;
		let match;
		let refCounter = 0;
		
		while ((match = regex.exec(htmlContent))) {
			const tag = match[1].toLowerCase();
			const ref = `ref-${refCounter++}`;
			const attrs = this._extractAttributes(match[0]);
			
			const element: ElementInfo = {
				ref,
				selector: `${tag}[data-ref="${ref}"]`,
				tagName: tag,
				role: attrs.role || this._inferRole(tag),
				ariaLabel: attrs['aria-label'] || '',
				text: attrs.value || attrs.placeholder || tag,
				isClickable: ['button', 'a', 'input'].includes(tag),
				isVisible: !attrs.hidden && attrs.style?.includes('display') === false,
				isFocusable: ['button', 'a', 'input', 'select'].includes(tag),
				type: attrs.type,
				placeholder: attrs.placeholder,
				value: attrs.value,
				disabled: 'disabled' in attrs,
				required: 'required' in attrs,
			};
			
			snapshot.elements.push(element);
			
			// Categorizar
			if (tag === 'button' || (tag === 'input' && element.type === 'submit')) {
				snapshot.buttons.push(element);
			} else if (tag === 'a') {
				snapshot.links.push(element);
			} else if (tag === 'input' || tag === 'select') {
				snapshot.inputs.push(element);
			} else if (tag === 'form') {
				snapshot.forms.push({
					ref,
					tagName: tag,
					selector: element.selector,
					inputs: [],
					buttons: [],
				});
			}
		}
	}

	private _extractAttributes(tagString: string): Record<string, string> {
		const attrs: Record<string, string> = {};
		const attrRegex = /(\w+(?:-\w+)*)(?:="([^"]*)"|='([^']*)')?/g;
		let match;
		
		while ((match = attrRegex.exec(tagString))) {
			const name = match[1];
			const value = match[2] || match[3] || '';
			attrs[name.toLowerCase()] = value;
		}
		
		return attrs;
	}

	private _inferRole(tagName: string): string {
		const roleMap: Record<string, string> = {
			'button': 'button',
			'a': 'link',
			'input': 'textbox',
			'select': 'listbox',
			'form': 'form',
			'img': 'img',
		};
		
		return roleMap[tagName] || 'generic';
	}

	private _generateHash(content: string): string {
		return this._simpleHash(content);
	}

	private _simpleHash(str: string): string {
		// Hash simples FNV-1a
		let hash = 2166136261;
		
		for (let i = 0; i < str.length; i++) {
			hash = (hash ^ str.charCodeAt(i)) >>> 0;
			hash = (hash * 16777619) >>> 0;
		}
		
		return hash.toString(16);
	}
}
