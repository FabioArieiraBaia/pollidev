/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { DOMSnapshot } from './domAnalysisService.js';

/**
 * Snapshot do estado do navegador em um ponto no tempo
 */
export interface BrowserStateSnapshot {
	url: string;
	timestamp: number;
	domHash: string;                // Hash do DOM para detectar mudanças
	elementCount: number;           // Total de elementos
	clickableCount: number;         // Elementos clicáveis
	formsPresent: string[];         // Nomes/IDs de formulários
	errorsPresent: string[];        // Mensagens de erro
	warningsPresent: string[];      // Avisos
	isLoading: boolean;             // Página em carregamento?
	navigationComplete: boolean;    // Navegação completada?
	networkPending: number;         // Requisições HTTP aguardando
}

/**
 * Mudança detectada no estado
 */
export interface StateChange {
	type: 'structure' | 'content' | 'error' | 'loading' | 'navigation';
	description: string;
	timestamp: number;
	severity: 'info' | 'warning' | 'error';
}

export const IBrowserStateTracker = createDecorator<IBrowserStateTracker>('BrowserStateTracker');

export interface IBrowserStateTracker {
	readonly _serviceBrand: undefined;
	
	/**
	 * Registra um novo snapshot do estado
	 */
	trackSnapshot(snapshot: DOMSnapshot): void;
	
	/**
	 * Detecta mudanças entre dois snapshots
	 */
	detectChanges(prev: BrowserStateSnapshot, curr: BrowserStateSnapshot): StateChange[];
	
	/**
	 * Verifica se o carregamento foi completado
	 */
	hasLoadingCompleted(): boolean;
	
	/**
	 * Detecta erros presentes na página
	 */
	detectErrorState(): string[];
	
	/**
	 * Retorna histórico de snapshots
	 */
	getStateHistory(limit: number): BrowserStateSnapshot[];
	
	/**
	 * Retorna mudanças recentes
	 */
	getRecentChanges(limit: number): StateChange[];
	
	/**
	 * Limpa histórico (quando navegação muda)
	 */
	clearHistory(): void;
}

export class BrowserStateTracker extends Disposable implements IBrowserStateTracker {
	_serviceBrand: undefined;

	private _snapshots: BrowserStateSnapshot[] = [];
	private _stateChanges: StateChange[] = [];
	private _maxHistorySize = 50;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	trackSnapshot(snapshot: DOMSnapshot): void {
		try {
			const stateSnapshot: BrowserStateSnapshot = {
				url: snapshot.url,
				timestamp: snapshot.timestamp,
				domHash: snapshot.hash,
				elementCount: snapshot.elements.length,
				clickableCount: snapshot.elements.filter(e => e.isClickable && e.isVisible).length,
				formsPresent: snapshot.forms.map(f => f.ref),
				errorsPresent: snapshot.errors,
				warningsPresent: snapshot.warnings,
				isLoading: snapshot.isLoading,
				navigationComplete: !snapshot.isLoading,
				networkPending: this._estimateNetworkPending(snapshot),
			};

			// Detectar mudanças em relação ao último snapshot
			if (this._snapshots.length > 0) {
				const prevSnapshot = this._snapshots[this._snapshots.length - 1];
				const changes = this.detectChanges(prevSnapshot, stateSnapshot);
				
				for (const change of changes) {
					this._recordChange(change);
				}
			}

			// Adicionar novo snapshot
			this._snapshots.push(stateSnapshot);

			// Manter tamanho máximo do histórico
			if (this._snapshots.length > this._maxHistorySize) {
				this._snapshots.shift();
			}

			this.logService.debug(`[BrowserStateTracker] Tracked snapshot: ${snapshot.url} with ${snapshot.elements.length} elements`);
		} catch (error) {
			this.logService.error(`[BrowserStateTracker] Error tracking snapshot: ${error}`);
		}
	}

	detectChanges(prev: BrowserStateSnapshot, curr: BrowserStateSnapshot): StateChange[] {
		const changes: StateChange[] = [];

		// Mudança na URL (navegação)
		if (prev.url !== curr.url) {
			changes.push({
				type: 'navigation',
				description: `Navigated from ${prev.url} to ${curr.url}`,
				timestamp: curr.timestamp,
				severity: 'info',
			});
		}

		// Mudança na estrutura do DOM
		if (prev.domHash !== curr.domHash) {
			changes.push({
				type: 'structure',
				description: `DOM structure changed (elements: ${prev.elementCount} → ${curr.elementCount})`,
				timestamp: curr.timestamp,
				severity: 'info',
			});
		}

		// Novos erros
		if (curr.errorsPresent.length > prev.errorsPresent.length) {
			const newErrors = curr.errorsPresent.filter(e => !prev.errorsPresent.includes(e));
			for (const error of newErrors) {
				changes.push({
					type: 'error',
					description: `Error detected: ${error}`,
					timestamp: curr.timestamp,
					severity: 'error',
				});
			}
		}

		// Novos avisos
		if (curr.warningsPresent.length > prev.warningsPresent.length) {
			const newWarnings = curr.warningsPresent.filter(w => !prev.warningsPresent.includes(w));
			for (const warning of newWarnings) {
				changes.push({
					type: 'content',
					description: `Warning detected: ${warning}`,
					timestamp: curr.timestamp,
					severity: 'warning',
				});
			}
		}

		// Mudança no estado de carregamento
		if (prev.isLoading !== curr.isLoading) {
			if (curr.isLoading) {
				changes.push({
					type: 'loading',
					description: 'Page started loading',
					timestamp: curr.timestamp,
					severity: 'info',
				});
			} else {
				changes.push({
					type: 'loading',
					description: 'Page finished loading',
					timestamp: curr.timestamp,
					severity: 'info',
				});
			}
		}

		// Mudança no conteúdo (número de elementos)
		const elementDiff = Math.abs(curr.elementCount - prev.elementCount);
		if (elementDiff > 5) {
			changes.push({
				type: 'content',
				description: `Page content changed significantly (${elementDiff} elements added/removed)`,
				timestamp: curr.timestamp,
				severity: curr.elementCount > prev.elementCount ? 'info' : 'warning',
			});
		}

		return changes;
	}

	hasLoadingCompleted(): boolean {
		if (this._snapshots.length === 0) return false;
		
		const latest = this._snapshots[this._snapshots.length - 1];
		const timeSinceLastChange = Date.now() - latest.timestamp;
		
		// Considerar carregamento completo se:
		// 1. isLoading é false E
		// 2. networkPending é 0 E
		// 3. Passaram mais de 500ms desde a última mudança
		return !latest.isLoading && latest.networkPending === 0 && timeSinceLastChange > 500;
	}

	detectErrorState(): string[] {
		if (this._snapshots.length === 0) return [];
		
		const latest = this._snapshots[this._snapshots.length - 1];
		return [...latest.errorsPresent, ...latest.warningsPresent];
	}

	getStateHistory(limit: number): BrowserStateSnapshot[] {
		const start = Math.max(0, this._snapshots.length - limit);
		return this._snapshots.slice(start);
	}

	getRecentChanges(limit: number): StateChange[] {
		const start = Math.max(0, this._stateChanges.length - limit);
		return this._stateChanges.slice(start);
	}

	clearHistory(): void {
		this._snapshots = [];
		this._stateChanges = [];
		this.logService.info('[BrowserStateTracker] History cleared');
	}

	// Private methods

	private _recordChange(change: StateChange): void {
		this._stateChanges.push(change);

		// Manter tamanho máximo
		if (this._stateChanges.length > this._maxHistorySize * 2) {
			this._stateChanges.shift();
		}

		this.logService.debug(`[BrowserStateTracker] ${change.type}: ${change.description}`);
	}

	private _estimateNetworkPending(snapshot: DOMSnapshot): number {
		// Heurística simples: contar quantas requisições ainda estão pendentes
		// Em uma implementação real, usar DevTools Protocol
		if (snapshot.isLoading) {
			return 1; // At least one request is pending
		}
		return 0;
	}
}
