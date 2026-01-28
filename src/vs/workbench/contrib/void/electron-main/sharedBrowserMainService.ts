/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Glass Devtools, Inc. All rights reserved.
 *  Void Editor additions licensed under the AGPL 3.0 License.
 *--------------------------------------------------------------------------------------------*/

import { BrowserWindow } from 'electron';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { BrowserAction, BrowserState } from './sharedBrowserChannel.js';

export const ISharedBrowserMainService = createDecorator<ISharedBrowserMainService>('SharedBrowserMainService');

export interface ISharedBrowserMainService {
	readonly _serviceBrand: undefined;
	readonly onDidUpdateState: Event<void>;
	createBrowserWindow(): Promise<void>;
	navigate(url: string): Promise<void>;
	executeAction(action: BrowserAction): Promise<any>;
	captureSnapshot(): Promise<string | null>;
	getSnapshot(): Promise<any>;
	show(): Promise<void>;
	setControlMode(mode: 'agent' | 'user'): Promise<void>;
	getState(): Promise<BrowserState>;
	getHtmlContent(): Promise<string | null>;
	close(): Promise<void>;
}

export interface ISharedProcessSharedBrowserService extends ISharedBrowserMainService {
	readonly onBrowserClosed: Event<void>;
}

export class SharedBrowserMainService extends Disposable implements ISharedBrowserMainService, ISharedProcessSharedBrowserService {
	_serviceBrand: undefined;

	private browserWindow: BrowserWindow | null = null;
	private _state: BrowserState = {
		currentUrl: null,
		currentSnapshot: null,
		controlMode: 'agent',
		isActive: false,
	};

	private readonly _onBrowserClosed = this._register(new Emitter<void>());
	readonly onBrowserClosed = this._onBrowserClosed.event;

	private readonly _onDidUpdateState = this._register(new Emitter<void>());
	readonly onDidUpdateState = this._onDidUpdateState.event;

	async createBrowserWindow(): Promise<void> {
		if (this.browserWindow && !this.browserWindow.isDestroyed()) {
			this.browserWindow.show();
			this.browserWindow.focus();
			return;
		}

		this.browserWindow = new BrowserWindow({
			width: 1280,
			height: 850,
			show: true, // Sempre visível
			title: 'PolliBot - Navegador de Automação',
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: false // Necessário para algumas automações avançadas
			},
		});

		// Marcar para permitir navegação no app.ts
		(this.browserWindow.webContents as any).isAgentAutomation = true;
		(this.browserWindow.webContents as any).isVoidAutomation = true;

		this.browserWindow.once('ready-to-show', () => {
			if (this.browserWindow) {
				this.browserWindow.show();
				this.browserWindow.focus();
			}
		});

		this.browserWindow.on('closed', () => {
			this.browserWindow = null;
			this._state.isActive = false;
			this._onBrowserClosed.fire();
			this._onDidUpdateState.fire();
		});

		this._state.isActive = true;
		this._onDidUpdateState.fire();
	}

	async navigate(url: string): Promise<void> {
		if (!this.browserWindow) {
			await this.createBrowserWindow();
		}

		if (this.browserWindow) {
			// Marcar para permitir navegação no app.ts se não estiver marcado
			if (!(this.browserWindow.webContents as any).isAgentAutomation) {
				(this.browserWindow.webContents as any).isAgentAutomation = true;
			}
			
			await this.browserWindow.loadURL(url);
			this._state.currentUrl = url;
			this._onDidUpdateState.fire();
			// Ensure window is shown after navigation
			if (!this.browserWindow.isVisible()) {
				this.browserWindow.show();
			}
		}
	}

	async show(): Promise<void> {
		if (this.browserWindow) {
			this.browserWindow.show();
			this.browserWindow.focus();
		}
	}

	async executeAction(action: BrowserAction): Promise<any> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			await this.createBrowserWindow();
		}

		const webContents = this.browserWindow!.webContents;
		
		// SEMPRE focar e mostrar a janela antes de qualquer ação
		this.browserWindow!.show();
		this.browserWindow!.focus();

		switch (action.type) {
			case 'navigate':
				if (action.url) {
					await this.navigate(action.url);
				}
				break;
			case 'click':
				const clickTarget = action.ref || action.element;
				if (clickTarget) {
					return await webContents.executeJavaScript(`
						(async function() {
							const target = "${clickTarget}";
							const element = document.querySelector('[data-void-ref="' + target + '"]') || 
											document.querySelector('[data-ref="' + target + '"]') || 
											document.querySelector(target);
							if (element) {
								element.scrollIntoView({ behavior: 'smooth', block: 'center' });
								await new Promise(r => setTimeout(r, 300)); // Esperar scroll
								
								element.focus();
								
								// Simular clique real ultra-robusto
								const rect = element.getBoundingClientRect();
								const x = rect.left + rect.width / 2;
								const y = rect.top + rect.height / 2;

								const mouseEvents = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
								mouseEvents.forEach(name => {
									const event = new MouseEvent(name, {
										bubbles: true,
										cancelable: true,
										view: window,
										clientX: x,
										clientY: y,
										buttons: 1
									});
									element.dispatchEvent(event);
								});
								
								// Alguns sites (FB) precisam de focus específico
								element.dispatchEvent(new Event('focus', { bubbles: true }));
								
								return { success: true, message: 'Clicked on ' + target };
							}
							return { success: false, message: 'Element not found: ' + target };
						})()
					`);
				}
				break;
			case 'type':
				const typeTarget = action.ref || action.element;
				if (typeTarget && action.text !== undefined) {
					return await webContents.executeJavaScript(`
						(async function() {
							const target = "${typeTarget}";
							const text = ${JSON.stringify(action.text)};
							const element = document.querySelector('[data-void-ref="' + target + '"]') || 
											document.querySelector('[data-ref="' + target + '"]') || 
											document.querySelector(target);
							if (element) {
								element.scrollIntoView({ behavior: 'smooth', block: 'center' });
								await new Promise(r => setTimeout(r, 300));
								
								element.focus();
								
								// Limpar de forma que o React/Vue perceba
								if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
									element.value = '';
								} else if (element.isContentEditable) {
									element.innerHTML = '';
								}
								
								element.dispatchEvent(new Event('input', { bubbles: true }));

								// Simular digitação caractere por caractere para sites com validação real-time
								for (let i = 0; i < text.length; i++) {
									const char = text[i];
									const keyEventParams = { key: char, char: char, keyCode: char.charCodeAt(0), bubbles: true };
									element.dispatchEvent(new KeyboardEvent('keydown', keyEventParams));
									element.dispatchEvent(new KeyboardEvent('keypress', keyEventParams));
									
									if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
										element.value += char;
									} else if (element.isContentEditable) {
										element.innerHTML += char;
									}
									
									element.dispatchEvent(new InputEvent('input', { data: char, bubbles: true }));
									element.dispatchEvent(new KeyboardEvent('keyup', keyEventParams));
									await new Promise(r => setTimeout(r, 10)); // Delay humano
								}

								element.dispatchEvent(new Event('change', { bubbles: true }));
								element.dispatchEvent(new Event('blur', { bubbles: true }));
								
								return { success: true, message: 'Typed text into ' + target };
							}
							return { success: false, message: 'Element not found: ' + target };
						})()
					`);
				}
				break;
			case 'hover':
				const hoverTarget = action.ref || action.element;
				if (hoverTarget) {
					await webContents.executeJavaScript(`
						(function() {
							const target = "${hoverTarget}";
							const element = document.querySelector('[data-void-ref="' + target + '"]') || 
											document.querySelector('[data-ref="' + target + '"]') || 
											document.querySelector(target);
							if (element) {
								element.scrollIntoView({ behavior: 'instant', block: 'center' });
								const rect = element.getBoundingClientRect();
								const x = rect.left + rect.width / 2;
								const y = rect.top + rect.height / 2;
								// Simulando hover via mousemove
								element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
								element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
								return true;
							}
							return false;
						})()
					`);
				}
				break;
			case 'press_key':
				if (action.key) {
					await webContents.sendInputEvent({ type: 'keyDown', viewModel: action.key } as any);
					await webContents.sendInputEvent({ type: 'keyUp', viewModel: action.key } as any);
				}
				break;
			case 'select_option':
				const selectTarget = action.ref || action.element;
				if (selectTarget && action.values) {
					await webContents.executeJavaScript(`
						(function() {
							const target = "${selectTarget}";
							const values = ${JSON.stringify(action.values)};
							const element = document.querySelector('[data-void-ref="' + target + '"]') || 
											document.querySelector('[data-ref="' + target + '"]') || 
											document.querySelector(target);
							if (element && element.tagName === 'SELECT') {
								Array.from(element.options).forEach(opt => {
									opt.selected = values.includes(opt.value) || values.includes(opt.text);
								});
								element.dispatchEvent(new Event('change', { bubbles: true }));
								element.dispatchEvent(new Event('input', { bubbles: true }));
								return true;
							}
							return false;
						})()
					`);
				}
				break;
			case 'wait_for':
				const waitTime = action.time;
				if (typeof waitTime === 'number' && waitTime > 0) {
					await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
				} else if (action.text) {
					const startTime = Date.now();
					const timeout = 10000; // 10s default
					while (Date.now() - startTime < timeout) {
						const found = await webContents.executeJavaScript(`
							document.body.innerText.includes(${JSON.stringify(action.text)})
						`);
						if (found) break;
						await new Promise(resolve => setTimeout(resolve, 500));
					}
				}
				break;
			case 'screenshot':
				return await this.captureSnapshot();
			case 'snapshot':
				return await this.getSnapshot();
			default:
				throw new Error(`Unsupported action type: ${action.type}`);
		}
	}

	async captureSnapshot(): Promise<string | null> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			return null;
		}
		try {
			const image = await this.browserWindow.webContents.capturePage();
			const dataUrl = image.toDataURL();
			this._state.currentSnapshot = dataUrl;
			this._onDidUpdateState.fire();
			// Return the base64 string, not the NativeImage object
			return dataUrl;
		} catch (error) {
			console.error('[SharedBrowserMainService] Screenshot error:', error);
			return null;
		}
	}

	async setControlMode(mode: 'agent' | 'user'): Promise<void> {
		this._state.controlMode = mode;
		this._onDidUpdateState.fire();
	}

	async getState(): Promise<BrowserState> {
		return { ...this._state };
	}

	async getHtmlContent(): Promise<string | null> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			return null;
		}
		try {
			return await this.browserWindow.webContents.executeJavaScript('document.documentElement.outerHTML');
		} catch (error) {
			return null;
		}
	}

	async close(): Promise<void> {
		if (this.browserWindow && !this.browserWindow.isDestroyed()) {
			this.browserWindow.close();
			this.browserWindow = null;
			this._state.isActive = false;
			this._state.currentUrl = null;
			this._state.currentSnapshot = null;
			this._onDidUpdateState.fire();
		}
	}

	async click(selector: string): Promise<void> {
		if (!this.browserWindow) {
			throw new Error('Browser window is not open');
		}
		await this.browserWindow.webContents.executeJavaScript(`
			document.querySelector('${selector}')?.click();
		`);
	}

	async type(selector: string, text: string): Promise<void> {
		if (!this.browserWindow) {
			throw new Error('Browser window is not open');
		}
		await this.browserWindow.webContents.executeJavaScript(`
			const element = document.querySelector('${selector}');
			if (element) {
				element.value = '${text}';
				element.dispatchEvent(new Event('input', { bubbles: true }));
			}
		`);
	}

	async screenshot(): Promise<string> {
		if (!this.browserWindow) {
			throw new Error('Browser window is not open');
		}
		const image = await this.browserWindow.webContents.capturePage();
		return image.toDataURL();
	}

	async getSnapshot(): Promise<any> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			throw new Error('Browser window is not open');
		}

		// Implementação inspirada no Clawdbot: extração de árvore de acessibilidade simplificada com refs
		const snapshot = await this.browserWindow.webContents.executeJavaScript(`
			(function() {
				const INTERACTIVE_ROLES = new Set([
					'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 
					'listbox', 'menuitem', 'option', 'searchbox', 'slider', 'spinbutton', 
					'switch', 'tab', 'treeitem', 'input', 'select', 'textarea'
				]);

				let refCounter = 0;
				const elementMap = new Map();

				function simplifyNode(node, depth = 0) {
					if (!node || depth > 10) return null;

					const role = node.getAttribute?.('role') || node.tagName?.toLowerCase();
					if (!role) return null;

					// Pular elementos de script/style
					if (role === 'script' || role === 'style' || role === 'meta' || role === 'head') return null;

					const name = node.getAttribute?.('aria-label') || 
								 node.getAttribute?.('name') || 
								 node.getAttribute?.('placeholder') ||
								 (node.innerText || '').trim().substring(0, 100);

					const isInteractive = INTERACTIVE_ROLES.has(role) || 
										 (node.tagName === 'INPUT' || node.tagName === 'BUTTON' || node.tagName === 'A' || node.tagName === 'SELECT');

					const ref = isInteractive ? 'e' + (++refCounter) : null;
					
					if (ref) {
						node.setAttribute('data-void-ref', ref);
					}

					const children = [];
					for (const child of node.children || []) {
						const simplifiedChild = simplifyNode(child, depth + 1);
						if (simplifiedChild) {
							children.push(simplifiedChild);
						}
					}

					// Se não for interativo e não tiver filhos úteis, e não tiver texto, ignorar (compactação)
					if (!isInteractive && children.length === 0 && !name) return null;

					return {
						role,
						name,
						ref,
						isInteractive,
						children: children.length > 0 ? children : undefined
					};
				}

				const tree = simplifyNode(document.body);
				return {
					url: window.location.href,
					title: document.title,
					tree,
					timestamp: Date.now()
				};
			})();
		`);

		return snapshot;
	}
}
