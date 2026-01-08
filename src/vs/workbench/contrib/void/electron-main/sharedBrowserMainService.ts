/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { BrowserWindow } from 'electron';
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
	close(): Promise<void>;
}

export class SharedBrowserMainService extends Disposable implements ISharedBrowserMainService {
	_serviceBrand: undefined;

	private browserWindow: BrowserWindow | null = null;
	private _state: BrowserState = {
		currentUrl: null,
		currentSnapshot: null,
		controlMode: 'agent',
		isActive: false,
	};

	private readonly _onDidUpdateState = this._register(new Emitter<void>());
	readonly onDidUpdateState = this._onDidUpdateState.event;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async getState(): Promise<BrowserState> {
		return { ...this._state };
	}

	async createBrowserWindow(): Promise<void> {
		if (this.browserWindow && !this.browserWindow.isDestroyed()) {
			this.logService.info('[SharedBrowserMainService] Browser window already exists');
			return;
		}

		this.browserWindow = new BrowserWindow({
			width: 1200,
			height: 800,
			show: false, // Don't show by default, will be controlled by renderer
			webPreferences: {
				sandbox: false, // Need full control for automation
				nodeIntegration: false,
				contextIsolation: true,
			},
		});

		// Load blank page initially
		await this.browserWindow.loadURL('about:blank');

		// Listen for navigation events
		this.browserWindow.webContents.on('did-navigate', (event, url) => {
			this._state.currentUrl = url;
			this._onDidUpdateState.fire();
			this.logService.info(`[SharedBrowserMainService] Navigated to ${url}`);
		});

		this.browserWindow.webContents.on('did-navigate-in-page', (event, url) => {
			this._state.currentUrl = url;
			this._onDidUpdateState.fire();
		});

		// Handle window close
		this.browserWindow.on('closed', () => {
			this.browserWindow = null;
			this._state.isActive = false;
			this._state.currentUrl = null;
			this._state.currentSnapshot = null;
			this._onDidUpdateState.fire();
		});

		this._state.isActive = true;
		this._onDidUpdateState.fire();
		this.logService.info('[SharedBrowserMainService] Browser window created');
	}

	async navigate(url: string): Promise<void> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			await this.createBrowserWindow();
		}

		if (this.browserWindow) {
			await this.browserWindow.loadURL(url);
			this._state.currentUrl = url;
			this._onDidUpdateState.fire();
		}
	}

	async executeAction(action: BrowserAction): Promise<any> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			throw new Error('Browser window not available');
		}

		const webContents = this.browserWindow.webContents;

		try {
			switch (action.type) {
				case 'navigate':
					if (action.url) {
						await this.navigate(action.url);
					}
					break;

				case 'click':
					// For clicks, we'd need to use CDP or inject JavaScript
					// This is a simplified version - full implementation would require element coordinates
					if (action.ref) {
						await webContents.executeJavaScript(`
							const element = document.querySelector('[data-ref="${action.ref}"]');
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
					}
					break;

				case 'press_key':
					if (action.key) {
						webContents.sendInputEvent({
							type: 'keyDown',
							keyCode: action.key,
						} as any);
						webContents.sendInputEvent({
							type: 'keyUp',
							keyCode: action.key,
						} as any);
					}
					break;

				case 'hover':
					if (action.ref) {
						await webContents.executeJavaScript(`
							const element = document.querySelector('[data-ref="${action.ref}"]');
							if (element) {
								element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
							}
						`);
					}
					break;

				case 'wait_for':
					if (action.time) {
						await new Promise(resolve => setTimeout(resolve, action.time! * 1000));
					} else if (action.text) {
						// Wait for text to appear
						await webContents.executeJavaScript(`
							new Promise((resolve) => {
								const observer = new MutationObserver(() => {
									if (document.body.innerText.includes(${JSON.stringify(action.text)})) {
										observer.disconnect();
										resolve();
									}
								});
								observer.observe(document.body, { childList: true, subtree: true });
								// Timeout after 10 seconds
								setTimeout(() => {
									observer.disconnect();
									resolve();
								}, 10000);
							});
						`);
					}
					break;

				case 'select_option':
					if (action.ref && action.values) {
						await webContents.executeJavaScript(`
							const element = document.querySelector('[data-ref="${action.ref}"]');
							if (element && element.tagName === 'SELECT') {
								element.value = ${JSON.stringify(action.values[0])};
								element.dispatchEvent(new Event('change', { bubbles: true }));
							}
						`);
					}
					break;
			}

			// Capture snapshot after action
			await this.captureSnapshot();
			return { success: true };
		} catch (error) {
			this.logService.error('[SharedBrowserMainService] Error executing action:', error);
			throw error;
		}
	}

	async captureSnapshot(): Promise<string | null> {
		if (!this.browserWindow || this.browserWindow.isDestroyed()) {
			return null;
		}

		try {
			const image = await this.browserWindow.webContents.capturePage();
			const buffer = image.toPNG();
			const base64 = buffer.toString('base64');
			this._state.currentSnapshot = base64;
			this._onDidUpdateState.fire();
			return base64;
		} catch (error) {
			this.logService.error('[SharedBrowserMainService] Error capturing snapshot:', error);
			return null;
		}
	}

	async setControlMode(mode: 'agent' | 'user'): Promise<void> {
		this._state.controlMode = mode;
		this._onDidUpdateState.fire();
		this.logService.info(`[SharedBrowserMainService] Control mode set to ${mode}`);
	}

	async close(): Promise<void> {
		if (this.browserWindow && !this.browserWindow.isDestroyed()) {
			this.browserWindow.close();
		}
		this.browserWindow = null;
		this._state.isActive = false;
		this._state.currentUrl = null;
		this._state.currentSnapshot = null;
		this._onDidUpdateState.fire();
		this.logService.info('[SharedBrowserMainService] Browser window closed');
	}
}

registerSingleton(ISharedBrowserMainService, SharedBrowserMainService, InstantiationType.Eager);

