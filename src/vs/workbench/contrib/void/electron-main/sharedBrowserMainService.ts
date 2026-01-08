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
			return;
		}

		this.browserWindow = new BrowserWindow({
			width: 1200,
			height: 800,
			show: false, // Don't show until ready to prevent white flash
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true
			},
		});

		// Show window when ready to prevent white flash
		this.browserWindow.once('ready-to-show', () => {
			this.browserWindow?.show();
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
			await this.browserWindow.loadURL(url);
			this._state.currentUrl = url;
			this._onDidUpdateState.fire();
			// Ensure window is shown after navigation
			if (!this.browserWindow.isVisible()) {
				this.browserWindow.show();
			}
		}
	}

	async executeAction(action: BrowserAction): Promise<any> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			throw new Error('Browser window is not open');
		}

		const webContents = this.browserWindow.webContents;

		switch (action.type) {
			case 'navigate':
				if (action.url) {
					await this.navigate(action.url);
				}
				break;
			case 'click':
				if (action.ref) {
					await webContents.executeJavaScript(`
						const element = document.querySelector('[data-ref="${action.ref}"]');
						if (element) element.click();
					`);
				} else if (action.element) {
					await webContents.executeJavaScript(`
						const element = document.querySelector('${action.element}');
						if (element) element.click();
					`);
				}
				break;
			case 'type':
				if (action.ref && action.text) {
					await webContents.executeJavaScript(`
						const element = document.querySelector('[data-ref="${action.ref}"]');
						if (element) {
							element.value = ${JSON.stringify(action.text)};
							element.dispatchEvent(new Event('input', { bubbles: true }));
						}
					`);
				} else if (action.element && action.text) {
					await webContents.executeJavaScript(`
						const element = document.querySelector('${action.element}');
						if (element) {
							element.value = ${JSON.stringify(action.text)};
							element.dispatchEvent(new Event('input', { bubbles: true }));
						}
					`);
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
			return dataUrl;
		} catch (error) {
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
		if (!this.browserWindow) {
			throw new Error('Browser window is not open');
		}

		const snapshot = await this.browserWindow.webContents.executeJavaScript(`
			(function() {
				function getAccessibilityTree(element) {
					const role = element.getAttribute('role') || element.tagName.toLowerCase();
					const name = element.getAttribute('aria-label') || element.getAttribute('name') || element.textContent?.trim().substring(0, 50);
					const tree = { role, name, children: [] };
					
					for (let child of element.children) {
						tree.children.push(getAccessibilityTree(child));
					}
					
					return tree;
				}
				return getAccessibilityTree(document.body);
			})();
		`);

		return { ...snapshot, timestamp: Date.now() };
	}
}
