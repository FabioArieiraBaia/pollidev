/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { ToolMessage } from './chatThreadServiceTypes.js';
import { ToolName } from './toolsServiceTypes.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { SharedBrowserChannelClient, BrowserAction as ChannelBrowserAction } from '../electron-main/sharedBrowserChannel.js';
import { timeout } from '../../../../base/common/async.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { PageAnalysis } from './agentSnapshotEnricher.js';
import { IDOMAnalysisService, DOMAnalysisService } from './domAnalysisService.js';
import { IBrowserStateTracker, BrowserStateTracker } from './browserStateTracker.js';
import { IPagePatternDetector, PagePatternDetector } from './pagePatternDetector.js';
import { IFailureAnalysisService, FailureAnalysisService } from './failureAnalysisService.js';
import { IAgentContextEnhancer, AgentContextEnhancerService } from './agentContextEnhancer.js';


export const ISharedBrowserService = createDecorator<ISharedBrowserService>('SharedBrowserService');

export interface BrowserAction {
	timestamp: number;
	type: 'navigate' | 'click' | 'type' | 'snapshot' | 'screenshot' | 'hover' | 'scroll';
	description: string;
	url?: string;
	element?: string;
	text?: string;
}

export interface BrowserError {
	type: 'navigation_failed' | 'element_not_found' | 'action_failed' | 'timeout' | 'unknown';
	message: string;
	timestamp: number;
	action?: BrowserAction;
	context?: any;
}

export interface SharedBrowserState {
	currentUrl: string | null;
	currentSnapshot: string | null; // base64 image
	actionHistory: BrowserAction[];
	isActive: boolean;
	controlMode: 'agent' | 'user';
	lastError: BrowserError | null;
	isLoading: boolean;
	pageLoadTimeout: number;
	// Agent Context Enhancement
	lastPageAnalysis?: PageAnalysis; // Análise enriquecida da última página
	lastAccessibilityContent?: string; // Para análise de mudanças
}

export interface ISharedBrowserService {
	readonly _serviceBrand: undefined;
	readonly state: SharedBrowserState;
	readonly onDidUpdateState: Event<void>;
	readonly onDidChangeControlMode: Event<'agent' | 'user'>;
	open(): Promise<void>;
	show(): Promise<void>;
	close(): Promise<void>;
	assumeUserControl(): Promise<void>;
	returnToAgentControl(): Promise<void>;
	executeUserAction(action: BrowserAction): Promise<void>;
	handleBrowserToolCall(toolCall: ToolMessage<ToolName>): Promise<void>;
}

export class SharedBrowserService extends Disposable implements ISharedBrowserService {
	_serviceBrand: undefined;

	private _state: SharedBrowserState = {
		currentUrl: null,
		currentSnapshot: null,
		actionHistory: [],
		isActive: false,
		controlMode: 'agent',
		lastError: null,
		isLoading: false,
		pageLoadTimeout: 30000, // 30 segundos
	};

	private readonly _onDidUpdateState = this._register(new Emitter<void>());
	readonly onDidUpdateState = this._onDidUpdateState.event;

	private readonly _onDidChangeControlMode = this._register(new Emitter<'agent' | 'user'>());
	readonly onDidChangeControlMode = this._onDidChangeControlMode.event;

	get state(): SharedBrowserState {
		return { ...this._state };
	}

	private _sharedBrowserMainService: SharedBrowserChannelClient;
	private _webviewPanel: any = null; // WebviewInput from IWebviewWorkbenchService

	constructor(
		@ILogService private readonly logService: ILogService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IWebviewWorkbenchService private readonly webviewWorkbenchService: IWebviewWorkbenchService,
		@IDOMAnalysisService private readonly domAnalysisService: IDOMAnalysisService,
		@IPagePatternDetector private readonly pagePatternDetector: IPagePatternDetector,
	) {
		super();
		
		// Initialize IPC client for SharedBrowserMainService
		const channel = this.mainProcessService.getChannel('void-channel-sharedBrowser');
		this._sharedBrowserMainService = new SharedBrowserChannelClient(channel);
		
		// Listen for state updates from main process
		this._register(this._sharedBrowserMainService.onDidUpdateState(() => {
			this._syncStateFromMain();
		}));

		// Auto-open if enabled in settings (com delay para evitar múltiplas chamadas)
		// IMPORTANTE: Não abrir automaticamente na inicialização - apenas quando o usuário habilitar explicitamente
		// ou quando uma ferramenta de browser for chamada
		this._register(this.settingsService.onDidChangeState(() => {
			const sharedBrowserEnabled = this.settingsService.state.globalSettings.sharedBrowserEnabled;
			
			// Só reagir a mudanças APÓS a inicialização ser concluída
			// Isso evita que o browser abra automaticamente na inicialização
			if (!this._isInitialized) {
				// Marcar como inicializado após um pequeno delay
				setTimeout(() => {
					this._isInitialized = true;
					this.logService.info('[SharedBrowserService] Initialization complete. Auto-open disabled on startup.');
				}, 2000);
				return; // Não processar mudanças durante a inicialização
			}
			
			// Só abrir se o usuário mudou explicitamente para true E não estava ativo antes
			if (sharedBrowserEnabled === true && !this._state.isActive && !this._isOpening) {
				// Cancelar timeout anterior se existir
				if (this._pendingOpenTimeout) {
					clearTimeout(this._pendingOpenTimeout);
					this._pendingOpenTimeout = undefined;
				}
				// Não abrir automaticamente - o browser será aberto quando necessário
				this.logService.info('[SharedBrowserService] sharedBrowserEnabled is true, but not auto-opening. Browser will open when a browser tool is called or user navigates.');
			} else if (sharedBrowserEnabled === false && this._state.isActive) {
				this.close();
			}
		}));

		// Marcar como inicializado após um delay para evitar auto-open na inicialização
		setTimeout(() => {
			this._isInitialized = true;
			this.logService.info('[SharedBrowserService] Initialization complete. Auto-open disabled on startup.');
		}, 3000);

		// O browser não deve abrir automaticamente na inicialização
		// Ele será aberto apenas quando:
		// 1. Uma ferramenta de browser for chamada (handleBrowserToolCall)
		// 2. O usuário executar uma ação de navegação explicitamente (executeUserAction)
	}

	private _isOpening = false; // Prevenir múltiplas chamadas simultâneas
	private _pendingOpenTimeout: NodeJS.Timeout | undefined; // Prevenir múltiplas chamadas assíncronas
	private _isInitialized = false; // Rastrear se a inicialização foi concluída

	async open(): Promise<void> {
		// Prevenir múltiplas chamadas simultâneas
		if (this._isOpening) {
			this.logService.info('[SharedBrowserService] open() already in progress, skipping...');
			return;
		}
		
		// Se já está ativo, apenas mostrar e focar
		if (this._state.isActive) {
			this.logService.info('[SharedBrowserService] Browser already active, showing...');
			await this.show();
			return;
		}

		this._isOpening = true;
		try {
			// Criar a janela do browser. Agora ela é criada como VISÍVEL por padrão no Main
			try {
				await this._sharedBrowserMainService.createBrowserWindow();
				this.logService.info('[SharedBrowserService] Browser window created for agent automation');
			} catch (ipcError) {
				this.logService.debug(`[SharedBrowserService] Main process browser window creation failed: ${ipcError}`);
			}

			// Marcar como ativo
			this._state.isActive = true;
			this._onDidUpdateState.fire();
			
			this.logService.info('[SharedBrowserService] Browser opened and visible');
		} catch (error) {
			this._state.isActive = false;
			this.logService.error(`[SharedBrowserService] Failed to open browser: ${error}`);
			throw error;
		} finally {
			this._isOpening = false;
		}
	}
	
	async show(): Promise<void> {
		try {
			await this._sharedBrowserMainService.show();
			this.logService.info('[SharedBrowserService] Requested main browser window to show');
		} catch (error) {
			this.logService.error(`[SharedBrowserService] Failed to show browser: ${error}`);
		}
	}

	async openWebviewPanel(): Promise<void> {
		// Se não está ativo, abrir browser primeiro
		if (!this._state.isActive) {
			await this.open();
		}
		
		// Garantir que a janela principal também apareça
		await this.show();

		// Se WebviewPanel já existe e não está disposed, apenas revelar
		if (this._webviewPanel && !this._webviewPanel.isDisposed) {
			this.logService.info('[SharedBrowserService] WebviewPanel already exists, revealing...');
			this.webviewWorkbenchService.revealWebview(this._webviewPanel, ACTIVE_GROUP, false);
			return;
		}
		
		// Criar WebviewPanel para visualização do usuário
		await this._openWebviewPanel(this._state.currentUrl || 'about:blank');
	}
	
	private async _syncStateFromMain(): Promise<void> {
		try {
			const mainState = await this._sharedBrowserMainService.getState();
			this._state.currentUrl = mainState.currentUrl;
			this._state.currentSnapshot = mainState.currentSnapshot;
			this._state.controlMode = mainState.controlMode;
			this._state.isActive = mainState.isActive;
		} catch (error) {
			this.logService.error(`[SharedBrowserService] Failed to sync state from main: ${error}`);
		}
	}

	async close(): Promise<void> {
		// Cancelar timeout pendente se existir
		if (this._pendingOpenTimeout) {
			clearTimeout(this._pendingOpenTimeout);
			this._pendingOpenTimeout = undefined;
		}

		if (!this._state.isActive) return;

		// Dispose of the webview panel if it exists
		if (this._webviewPanel && !this._webviewPanel.isDisposed) {
			this.logService.info('[SharedBrowserService] Disposing webview panel');
			this._webviewPanel.dispose();
			this._webviewPanel = null;
		}
		
		this._state.isActive = false;
		this._state.currentUrl = null;
		this._state.currentSnapshot = null;
		this._state.actionHistory = [];
		this._onDidUpdateState.fire();
		this.logService.info('[SharedBrowserService] Browser view closed');
	}

	async assumeUserControl(): Promise<void> {
		if (this._state.controlMode === 'user') return;
		
		// In iframe mode, just update local state - no IPC needed
		this._state.controlMode = 'user';
		this._onDidChangeControlMode.fire('user');
		this._onDidUpdateState.fire();
		this.logService.info('[SharedBrowserService] User assumed control');
	}

	async returnToAgentControl(): Promise<void> {
		if (this._state.controlMode === 'agent') return;
		
		// In iframe mode, just update local state - no IPC needed
		this._state.controlMode = 'agent';
		this._onDidChangeControlMode.fire('agent');
		this._onDidUpdateState.fire();
		this.logService.info('[SharedBrowserService] Control returned to agent');
	}

	async executeUserAction(action: BrowserAction): Promise<void> {
		// Force assume user control if not already
		if (this._state.controlMode !== 'user') {
			this.logService.info('[SharedBrowserService] Auto-assuming user control for user action');
			await this.assumeUserControl();
			// Wait a bit for state to sync
			await timeout(200);
		}

		// Ensure browser is open
		if (!this._state.isActive) {
			await this.open();
		}

		// Add user action to history
		this._addAction({
			...action,
			timestamp: Date.now(),
		});

		// For navigation, ensure WebviewPanel exists for user visualization
		if (action.type === 'navigate' && action.url) {
			this._state.currentUrl = action.url;
			await this.openWebviewPanel(); // Usar novo método que garante single instance
			this._onDidUpdateState.fire();
			this.logService.info(`[SharedBrowserService] User navigated to: ${action.url}`);
			return;
		}

		// For other actions, try to execute via IPC (for agent automation capabilities)
		// But iframe mode allows direct user interaction, so these are optional
		try {
			const channelAction: ChannelBrowserAction = {
				type: action.type as any,
				url: action.url,
				element: action.element,
				ref: action.element, // Use element as ref if available
				text: action.text,
			};
			
			// Only execute via IPC if BrowserWindow is available (for automation)
			// In iframe mode, user interacts directly with iframe
			if (this._state.isActive) {
				// Try to execute, but don't fail if BrowserWindow is not available
				try {
					await this._sharedBrowserMainService.executeAction(channelAction);
					await this._syncStateFromMain();
				} catch (error) {
					// In iframe mode, automation may not be available - this is OK
					this.logService.debug(`[SharedBrowserService] Action execution skipped (iframe mode): ${error}`);
				}
			}
			
			this._onDidUpdateState.fire();
			this.logService.info(`[SharedBrowserService] User action executed: ${action.type} - ${action.url || action.description}`);
		} catch (error) {
			this.logService.error(`[SharedBrowserService] Failed to execute user action: ${error}`);
			// Don't throw - iframe allows direct interaction anyway
		}
	}

	async handleBrowserToolCall(toolCall: ToolMessage<ToolName>): Promise<any> {
		if (!this._state.isActive) {
			// Auto-open if browser tool is called
			await this.open();
		}

		// Only execute if control mode is 'agent'
		if (this._state.controlMode !== 'agent') {
			this.logService.info('[SharedBrowserService] Browser tool call ignored - control mode is user');
			return { error: 'Browser control mode is currently set to USER. Ask the user to return control to the agent.' };
		}

		const toolName = toolCall.name;
		const timestamp = Date.now();

		// Convert tool call to browser action and execute via IPC
		let channelAction: ChannelBrowserAction | null = null;

		if (toolName === 'mcp_cursor-ide-browser_browser_navigate' || toolName === 'browser_navigate') {
			const url = toolCall.rawParams?.url as string | undefined;
			if (url) {
				// NÃO criar WebviewPanel durante automação - apenas atualizar state e executar via IPC
				this._state.currentUrl = url;
				channelAction = { type: 'navigate', url };
				this._addAction({
					timestamp,
					type: 'navigate',
					description: `Navigated to ${url}`,
					url,
				});
				// Fire state update immediately
				this._onDidUpdateState.fire();
			}
		} else if (toolName === 'mcp_cursor-ide-browser_browser_click') {
			const element = toolCall.rawParams?.element as string | undefined;
			const ref = toolCall.rawParams?.ref as string | undefined;
			channelAction = { type: 'click', element: element || ref, ref };
			this._addAction({
				timestamp,
				type: 'click',
				description: `Clicked on element: ${element || ref || 'unknown'}`,
				element: element || ref,
			});
			// Synchronize the visible browser with the agent's browser
			void this._syncBrowserWithAgent();
		} else if (toolName === 'mcp_cursor-ide-browser_browser_type') {
			const text = toolCall.rawParams?.text as string | undefined;
			const element = toolCall.rawParams?.element as string | undefined;
			const ref = toolCall.rawParams?.ref as string | undefined;
			channelAction = { type: 'type', element, ref, text };
			this._addAction({
				timestamp,
				type: 'type',
				description: `Typed "${text}" into element: ${element || 'unknown'}`,
				element,
				text,
			});
			// Synchronize the visible browser with the agent's browser
			void this._syncBrowserWithAgent();
		} else if (toolName === 'mcp_cursor-ide-browser_browser_snapshot') {
			channelAction = { type: 'snapshot' };
			this._addAction({
				timestamp,
				type: 'snapshot',
				description: 'Took accessibility snapshot of page',
			});
			// Synchronize the visible browser with the agent's browser
			void this._syncBrowserWithAgent();
		} else if (toolName === 'mcp_cursor-ide-browser_browser_take_screenshot') {
			channelAction = { type: 'screenshot' };
			this._addAction({
				timestamp,
				type: 'screenshot',
				description: 'Took screenshot of page',
			});
		} else if (toolName === 'mcp_cursor-ide-browser_browser_hover') {
			const element = toolCall.rawParams?.element as string | undefined;
			const ref = toolCall.rawParams?.ref as string | undefined;
			channelAction = { type: 'hover', element, ref };
			this._addAction({
				timestamp,
				type: 'hover',
				description: `Hovered over element: ${element || 'unknown'}`,
				element,
			});
		} else if (toolName === 'mcp_cursor-ide-browser_browser_press_key') {
			const key = toolCall.rawParams?.key as string | undefined;
			channelAction = { type: 'press_key', key };
			this._addAction({
				timestamp,
				type: 'click', // Use click as fallback type
				description: `Pressed key: ${key}`,
			});
		} else if (toolName === 'mcp_cursor-ide-browser_browser_select_option') {
			const element = toolCall.rawParams?.element as string | undefined;
			const ref = toolCall.rawParams?.ref as string | undefined;
			const values = toolCall.rawParams?.values as string[] | undefined;
			channelAction = { type: 'select_option', element, ref, values };
			this._addAction({
				timestamp,
				type: 'click', // Use click as fallback type
				description: `Selected option in element: ${element || 'unknown'}`,
				element,
			});
		} else if (toolName === 'mcp_cursor-ide-browser_browser_wait_for') {
			const time = toolCall.rawParams?.time as number | undefined;
			const text = toolCall.rawParams?.text as string | undefined;
			const textGone = toolCall.rawParams?.textGone as string | undefined;
			channelAction = { type: 'wait_for', time, text, textGone };
			this._addAction({
				timestamp,
				type: 'click', // Use click as fallback type
				description: time ? `Waited for ${time} seconds` : `Waited for text: ${text || 'unknown'}`,
			});
		} else if (toolName === 'browser_show' || toolName === 'mcp_cursor-ide-browser_browser_show') {
			await this.show();
			return { success: true, message: 'Browser window is now visible and focused.' };
		} else if (toolName === 'browser_scroll' || toolName === 'mcp_cursor-ide-browser_browser_scroll') {
			const element = toolCall.rawParams?.element as string | undefined;
			const ref = toolCall.rawParams?.ref as string | undefined;
			channelAction = { type: 'scroll', element: element || ref, ref };
			this._addAction({
				timestamp,
				type: 'scroll',
				description: element ? `Scrolled to element: ${element}` : 'Scrolled page down',
				element: element || ref,
			});
		}

		// Execute action via IPC if we have one
		if (channelAction) {
			try {
				this._state.isLoading = true;
				this._clearError();
				this._onDidUpdateState.fire();

				await this._sharedBrowserMainService.executeAction(channelAction);
				
				// Capture snapshot and state after action
				const snapshotData = await this._sharedBrowserMainService.getSnapshot();
				if (snapshotData) {
					// Usar o serviço de análise para processar o snapshot de forma robusta
					const processedSnapshot = this.domAnalysisService.processBrowserSnapshot(snapshotData);
					
					// Detectar padrões de página (Facebook, WhatsApp, etc)
					const pattern = this.pagePatternDetector.detectPattern(processedSnapshot);
					
					// Atualizar o estado
					this._state.currentSnapshot = processedSnapshot as any;
					this._state.lastPageAnalysis = { pattern } as any;
					this._state.lastAccessibilityContent = snapshotData.snapshotText;
				}
				
				await this._syncStateFromMain();
				this._state.isLoading = false;
				
				this.logService.info(`[SharedBrowserService] Browser action executed successfully: ${channelAction.type}`);
			} catch (error) {
				this._state.isLoading = false;
				
				// Determinar tipo de erro
				let errorType: BrowserError['type'] = 'action_failed';
				let errorMessage = String(error);
				
				if (errorMessage.includes('not found')) {
					errorType = 'element_not_found';
				} else if (errorMessage.includes('timeout')) {
					errorType = 'timeout';
				} else if (channelAction.type === 'navigate') {
					errorType = 'navigation_failed';
				}
				
				this._recordError({
					type: errorType,
					message: errorMessage,
					timestamp: Date.now(),
					action: channelAction as any,
					context: {
						url: this._state.currentUrl,
						toolName: toolName
					}
				});

				this.logService.error(`[SharedBrowserService] Failed to execute browser action (${errorType}): ${error}`);
				
				return { 
					error: `Failed to execute browser action: ${error}`,
					errorType: errorType,
					action: channelAction.type,
					url: this._state.currentUrl,
					recoveryAdvice: this._getRecoveryAdvice(errorType)
				};
			}
		}

		this._onDidUpdateState.fire();

		// Return the current state to the agent
		return {
			url: this._state.currentUrl,
			snapshot: this._state.currentSnapshot, // This contains the accessibility tree/text with refs [e1], [e2], etc.
			success: true,
			message: `Action ${toolName} executed successfully.`,
			lastError: this._state.lastError,
			isLoading: this._state.isLoading,
			instructions: 'You can now use the numeric references [e1], [e2], etc. found in the snapshot to interact with elements using browser_click or browser_type.'
		};
	}

	private _addAction(action: BrowserAction): void {
		this._state.actionHistory.push(action);
		// Keep only last 100 actions
		if (this._state.actionHistory.length > 100) {
			this._state.actionHistory.shift();
		}
	}

	private _recordError(error: BrowserError): void {
		this._state.lastError = error;
		this.logService.error(`[SharedBrowserService] Browser Error [${error.type}]: ${error.message}`);
		this._onDidUpdateState.fire();
	}

	private _clearError(): void {
		this._state.lastError = null;
	}

	private _getRecoveryAdvice(errorType: BrowserError['type']): string {
		switch (errorType) {
			case 'element_not_found':
				return 'Try taking a snapshot to see the current page state, then use a different selector or element reference.';
			case 'navigation_failed':
				return 'Check if the URL is valid. Try navigating to a simpler page first to test connectivity.';
			case 'timeout':
				return 'The page took too long to load. Try waiting a bit longer or checking your internet connection.';
			case 'action_failed':
				return 'The action could not be completed. Try taking a screenshot to see the current state.';
			default:
				return 'An unknown error occurred. Try taking a snapshot to diagnose the problem.';
		}
	}

	private async _openWebviewPanel(url: string): Promise<void> {
		try {
			this.logService.info(`[SharedBrowserService] _openWebviewPanel called: url=${url}, hasPanel=${!!this._webviewPanel}, disposed=${this._webviewPanel?.isDisposed}`);
			
			// If webview panel already exists, optimize update
			if (this._webviewPanel && !this._webviewPanel.isDisposed) {
				// If URL is the same, just reveal without updating HTML to avoid style accumulation
				if (this._state.currentUrl === url) {
					this.logService.info(`[SharedBrowserService] URL unchanged (${url}), just revealing webview`);
					await timeout(100);
					this.webviewWorkbenchService.revealWebview(this._webviewPanel, ACTIVE_GROUP, false);
					return;
				}
				
				// If URL changed, update only the iframe src via postMessage instead of redefining entire HTML
				const webview = this._webviewPanel.webview;
				const normalizedUrl = this._normalizeUrl(url);
				
				this.logService.info(`[SharedBrowserService] URL changed from ${this._state.currentUrl} to ${url}, updating iframe via postMessage`);
				
				// Update iframe src via postMessage to avoid redefining entire HTML
				webview.postMessage({
					type: 'navigateIframe',
					url: normalizedUrl
				});
				
				this._state.currentUrl = url;
				this._onDidUpdateState.fire();
				await timeout(100);
				this.webviewWorkbenchService.revealWebview(this._webviewPanel, ACTIVE_GROUP, false);
				return;
			}

			// Create new webview panel
			this.logService.info(`[SharedBrowserService] Creating new WebviewPanel...`);
			this._webviewPanel = this.webviewWorkbenchService.openWebview(
				{ 
					providedViewType: 'void.sharedBrowser', 
					title: 'Shared Browser', 
					options: { enableFindWidget: true }, 
					contentOptions: { allowScripts: true, allowForms: true }, 
					extension: undefined 
				},
				'void.sharedBrowser',
				'Shared Browser',
				{ group: ACTIVE_GROUP, preserveFocus: false }
			);
			
			this.logService.info(`[SharedBrowserService] WebviewPanel created, setting up listeners and content...`);
			
			// Register a listener to update internal state if the panel is disposed externally
			if (this._webviewPanel && typeof this._webviewPanel.onWillDispose === 'function') {
				const disposeListener = this._webviewPanel.onWillDispose(() => {
					this.logService.info('[SharedBrowserService] WebviewPanel will be disposed');
					this._state.isActive = false;
					this._state.currentUrl = null;
					this._state.currentSnapshot = null;
					this._state.actionHistory = [];
					this._onDidUpdateState.fire();
				});
				this._register(disposeListener);
			} else {
				this.logService.warn('[SharedBrowserService] onWillDispose not available on webviewPanel');
			}

			// Get CSP source before setting HTML
			const cspSource = this._webviewPanel.webview.cspSource || `'self' https://*.vscode-cdn.net`;
			const html = this._getBrowserHtml(url, cspSource);
			
			// Set HTML content
			this.logService.info(`[SharedBrowserService] Setting HTML content: url=${url}, cspSource=${cspSource}, htmlLength=${html.length}`);
			this._webviewPanel.webview.html = html;

			// Add message listener
			this._register(this._webviewPanel.webview.onMessage((event: { message: any }) => {
				const message = event.message;
				if (message && message.type === 'navigate') {
					this._state.currentUrl = message.url;
					this._onDidUpdateState.fire();
					this.logService.info(`[SharedBrowserService] Navigation message received: ${message.url}`);
				} else if (message && message.type === 'openExternal') {
					this.logService.info(`[SharedBrowserService] Open external requested: ${message.url}`);
				} else if (message && message.type === 'action') {
					this.logService.info(`[SharedBrowserService] Action from webview: ${JSON.stringify(message.action)}`);
					if (this._state.controlMode === 'user') {
						this.logService.info('[SharedBrowserService] User action in webview ignored as control mode is USER');
					} else {
						this._addAction({
							timestamp: Date.now(),
							type: message.action.type,
							description: message.action.description || `Performed action: ${message.action.type}`,
							element: message.action.element,
							text: message.action.type === 'type' ? message.action.text : undefined,
							url: message.action.url,
						});
						this._onDidUpdateState.fire();
					}
				} else if (message && message.type === 'updateState') {
					this.logService.info('[SharedBrowserService] State update from webview');
					this._state = { ...this._state, ...message.state };
					this._onDidUpdateState.fire();
				}
			}));

			this.logService.info(`[SharedBrowserService] WebviewPanel setup complete for: ${url}`);
			
			// Wait a bit for the webview to be fully mounted before revealing
			await timeout(500);
			
			// Reveal the webview once (removed multiple redundant reveals to avoid performance issues)
			this.webviewWorkbenchService.revealWebview(this._webviewPanel, ACTIVE_GROUP, false);
			this.logService.info(`[SharedBrowserService] WebviewPanel opened and revealed for: ${url}`);
		} catch (error) {
			this.logService.error(`[SharedBrowserService] Failed to open WebviewPanel: ${error}`, error);
			throw error;
		}
	}

	private async _syncBrowserWithAgent(): Promise<void> {
		// This method synchronizes the visible iframe with the agent's browser window
		// by capturing screenshots or state from the main process browser
		if (!this._webviewPanel) return;

		try {
			// Request a screenshot from the main process browser window
			const screenshot = await this._sharedBrowserMainService.captureSnapshot();
			if (screenshot) {
				// Post the screenshot data to the webview to display it
				this._webviewPanel.webview.postMessage({
					type: 'updateScreenshot',
					data: screenshot
				});
			}
		} catch (error) {
			this.logService.debug(`[SharedBrowserService] Failed to sync browser screenshot: ${error}`);
		}
	}

	private _normalizeUrl(url: string): string {
		if (!url || url.trim() === '') {
			return 'about:blank';
		}
		url = url.trim();
		try {
			// Se já é uma URL válida, retornar
			new URL(url);
			return url;
		} catch (e) {
			// Tentar adicionar https://
			if (!url.match(/^[a-zA-Z][a-zA-Z\d+.-]*:/)) {
				return 'https://' + url;
			}
			return url;
		}
	}

	private _getBrowserHtml(url: string, cspSource: string): string {
		const nonce = Math.random().toString(36).substring(2, 15);
		// Escapar URL para uso seguro no HTML
		const safeUrl = url || 'about:blank';
		// Garantir que cspSource tenha um valor válido
		const safeCspSource = cspSource || `'self' https://*.vscode-cdn.net`;
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
	<meta http-equiv="Content-Security-Policy" content="
		default-src 'self' https: http: ws: wss:;
		font-src data:;
		style-src 'self' ${safeCspSource} 'unsafe-inline' https: http:;
		script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https: http:;
		frame-src 'self' *;
		connect-src 'self' https: http: ws: wss: http://127.0.0.1:* http://localhost:*;
		img-src 'self' https: http: data:;
		media-src 'self' https: http: data:;
	">
	<style>
		* {
			box-sizing: border-box;
		}
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			width: 100vw;
			height: 100vh;
			display: flex;
			flex-direction: column;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			font-size: 13px;
			background-color: #1e1e1e;
			color: #cccccc;
		}
		.header {
			display: flex;
			align-items: center;
			padding: 6px 8px;
			background-color: #2d2d30;
			border-bottom: 1px solid #3e3e42;
			gap: 6px;
			flex-shrink: 0;
			min-height: 36px;
		}
		.controls {
			display: flex;
			gap: 4px;
			align-items: center;
		}
		.icon {
			width: 28px;
			height: 28px;
			border: 1px solid #3e3e42;
			background-color: #3c3c3c;
			color: #cccccc;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 2px;
			font-size: 16px;
			line-height: 1;
			padding: 0;
		}
		.icon:hover:not(:disabled) {
			background-color: #404040;
		}
		.icon:active:not(:disabled) {
			background-color: #37373d;
		}
		.icon:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
		.url-input {
			flex: 1;
			padding: 4px 8px;
			border: 1px solid #3e3e42;
			background-color: #1e1e1e;
			color: #cccccc;
			border-radius: 2px;
			font-family: inherit;
			font-size: 13px;
			min-width: 0;
		}
		.url-input:focus {
			outline: 1px solid #007acc;
			outline-offset: -1px;
			border-color: #007acc;
		}
		.content {
			flex: 1;
			position: relative;
			overflow: hidden;
			background-color: #ffffff;
			min-height: 0;
		}
		.browser-frame {
			width: 100%;
			height: 100%;
			border: 0;
			display: block !important;
			visibility: visible !important;
			opacity: 1 !important;
			position: relative;
			z-index: 1;
			background-color: #ffffff;
			min-height: 0;
		}
	</style>
</head>
<body>
	<header class="header">
		<nav class="controls">
			<button class="icon" id="back-btn" title="Back" aria-label="Back">←</button>
			<button class="icon" id="forward-btn" title="Forward" aria-label="Forward">→</button>
			<button class="icon" id="reload-btn" title="Reload" aria-label="Reload">↻</button>
		</nav>
		<input class="url-input" type="text" id="url-input" placeholder="Enter URL..." value="${safeUrl.replace(/"/g, '&quot;')}" spellcheck="false">
		<nav class="controls">
			<button class="icon" id="open-external-btn" title="Open in external browser" aria-label="Open externally">↗</button>
		</nav>
	</header>
		<div class="content">
			<iframe 
				id="browser-frame"
				class="browser-frame"
				sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation"
			></iframe>
		</div>
	<script nonce="${nonce}">
		(function() {
			const vscode = acquireVsCodeApi();
			const iframe = document.getElementById('browser-frame');
			const urlInput = document.getElementById('url-input');
			const backBtn = document.getElementById('back-btn');
			const forwardBtn = document.getElementById('forward-btn');
			const reloadBtn = document.getElementById('reload-btn');
			const openExternalBtn = document.getElementById('open-external-btn');
			
			let currentUrl = ${JSON.stringify(safeUrl)};
			let history = [currentUrl];
			let historyIndex = 0;
			
			// Função para normalizar URL
			function normalizeUrl(url) {
				if (!url || url.trim() === '') {
					return 'about:blank';
				}
				url = url.trim();
				try {
					// Se já é uma URL válida, retornar
					new URL(url);
					return url;
				} catch (e) {
					// Tentar adicionar https://
					if (!url.match(/^[a-zA-Z][a-zA-Z\\d+.-]*:/)) {
						return 'https://' + url;
					}
					return url;
				}
			}
			
			// Função para navegar
			function navigate(url, skipHistory) {
				try {
					const normalizedUrl = normalizeUrl(url);
					
					// Adicionar timestamp para evitar cache
					let finalUrl = normalizedUrl;
					if (normalizedUrl !== 'about:blank' && !normalizedUrl.startsWith('about:')) {
						try {
							const urlObj = new URL(normalizedUrl);
							urlObj.searchParams.set('vscodeBrowserReqId', Date.now().toString());
							finalUrl = urlObj.toString();
						} catch (e) {
							// Se falhar, usar URL original
							finalUrl = normalizedUrl;
						}
					}
					
					// Garantir que o iframe esteja visível antes de definir src
					iframe.style.display = 'block';
					iframe.style.visibility = 'visible';
					iframe.style.opacity = '1';
					
					// Definir src
					iframe.src = finalUrl;
					currentUrl = normalizedUrl;
					urlInput.value = currentUrl;
					
					// Atualizar histórico
					if (!skipHistory) {
						if (history[history.length - 1] !== currentUrl) {
							history = history.slice(0, historyIndex + 1);
							history.push(currentUrl);
							historyIndex = history.length - 1;
						}
					}
					
					updateButtons();
					
					// Notificar extensão sobre navegação
					vscode.postMessage({
						type: 'navigate',
						url: currentUrl
					});
				} catch (e) {
					console.error('Navigation error:', e);
					iframe.src = url;
				}
			}
			
			// Atualizar estado dos botões
			function updateButtons() {
				backBtn.disabled = historyIndex <= 0;
				forwardBtn.disabled = historyIndex >= history.length - 1;
			}
			
			// Event listeners
			urlInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					navigate(urlInput.value);
				}
			});
			
			urlInput.addEventListener('blur', () => {
				urlInput.value = currentUrl;
			});
			
			backBtn.addEventListener('click', () => {
				if (historyIndex > 0) {
					historyIndex--;
					const url = history[historyIndex];
					navigate(url, true);
				}
			});
			
			forwardBtn.addEventListener('click', () => {
				if (historyIndex < history.length - 1) {
					historyIndex++;
					const url = history[historyIndex];
					navigate(url, true);
				}
			});
			
			reloadBtn.addEventListener('click', () => {
				if (iframe.src) {
					iframe.src = iframe.src;
				}
			});
			
			openExternalBtn.addEventListener('click', () => {
				vscode.postMessage({
					type: 'openExternal',
					url: currentUrl
				});
			});
			
			// Monitorar navegação do iframe (quando possível)
			iframe.addEventListener('load', () => {
				try {
					// Tentar obter URL do iframe (pode falhar em cross-origin)
					const iframeUrl = iframe.contentWindow.location.href;
					if (iframeUrl && iframeUrl !== 'about:blank' && iframeUrl !== currentUrl) {
						currentUrl = iframeUrl;
						urlInput.value = currentUrl;
						
						// Atualizar histórico apenas se diferente
						if (history[history.length - 1] !== currentUrl) {
							history = history.slice(0, historyIndex + 1);
							history.push(currentUrl);
							historyIndex = history.length - 1;
						}
						
						updateButtons();
						
						// Notificar extensão
						vscode.postMessage({
							type: 'navigate',
							url: currentUrl
						});
					}
				} catch (e) {
					// Cross-origin error - normal, apenas log
					console.log('Cannot access iframe URL (cross-origin):', e.message);
				}
			});
			
			iframe.addEventListener('error', (e) => {
				console.error('iframe error:', e);
			});
			
			// Navegar para URL inicial sempre, mesmo se for about:blank
			// Isso garante que o iframe seja inicializado corretamente
			if (currentUrl) {
				if (currentUrl !== 'about:blank') {
					navigate(currentUrl);
				} else {
					// Se for about:blank, definir explicitamente e garantir visibilidade
					iframe.src = 'about:blank';
					updateButtons();
					// Notificar que está pronto
					vscode.postMessage({
						type: 'navigate',
						url: currentUrl
					});
				}
			} else {
				// Sem URL definida, usar about:blank
				iframe.src = 'about:blank';
				updateButtons();
			}
			
			// Forçar carregamento inicial após um pequeno delay para garantir que o VS Code terminou de montar o Webview
			// Estilos agora são gerenciados via CSS (classe browser-frame), sem necessidade de estilos inline
			setTimeout(() => {
				// Se ainda não tiver src definido ou estiver em about:blank sem URL, tentar carregar
				if (!iframe.src || iframe.src === 'about:blank') {
					if (currentUrl && currentUrl !== 'about:blank') {
						navigate(currentUrl);
					} else {
						// Garantir que about:blank esteja carregado
						iframe.src = 'about:blank';
						updateButtons();
					}
				}
			}, 500);
			
			// Handler para receber mensagens do VS Code (ex: navigateIframe para evitar redefinir HTML completo)
			window.addEventListener('message', (event) => {
				const message = event.data;
				if (message && message.type === 'navigateIframe' && message.url) {
					// Atualizar apenas o iframe src sem recarregar HTML completo
					const normalizedUrl = normalizeUrl(message.url);
					let finalUrl = normalizedUrl;
					if (normalizedUrl !== 'about:blank' && !normalizedUrl.startsWith('about:')) {
						try {
							const urlObj = new URL(normalizedUrl);
							urlObj.searchParams.set('vscodeBrowserReqId', Date.now().toString());
							finalUrl = urlObj.toString();
						} catch (e) {
							finalUrl = normalizedUrl;
						}
					}
					
					// Atualizar src do iframe (visibilidade gerenciada via CSS)
					iframe.src = finalUrl;
					currentUrl = normalizedUrl;
					urlInput.value = currentUrl;
					
					// Atualizar histórico
					if (history[history.length - 1] !== currentUrl) {
						history = history.slice(0, historyIndex + 1);
						history.push(currentUrl);
						historyIndex = history.length - 1;
					}
					
					updateButtons();
					
					// Notificar extensão
					vscode.postMessage({
						type: 'navigate',
						url: currentUrl
					});
				}
			});
		})();
	</script>
</body>
</html>`;
		return html;
	}
}

registerSingleton(ISharedBrowserService, SharedBrowserService, InstantiationType.Eager);
registerSingleton(IDOMAnalysisService, DOMAnalysisService, InstantiationType.Delayed);
registerSingleton(IBrowserStateTracker, BrowserStateTracker, InstantiationType.Delayed);
registerSingleton(IPagePatternDetector, PagePatternDetector, InstantiationType.Delayed);
registerSingleton(IFailureAnalysisService, FailureAnalysisService, InstantiationType.Delayed);
registerSingleton(IAgentContextEnhancer, AgentContextEnhancerService, InstantiationType.Delayed);



