/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IChannel, IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ISharedBrowserMainService } from './sharedBrowserMainService.js';

export interface BrowserAction {
	type: 'navigate' | 'click' | 'type' | 'snapshot' | 'screenshot' | 'hover' | 'scroll' | 'press_key' | 'select_option' | 'wait_for';
	url?: string;
	element?: string;
	ref?: string;
	text?: string;
	key?: string;
	values?: string[];
	time?: number;
	textGone?: string;
	timestamp?: number;
	description?: string;
}

export interface BrowserState {
	currentUrl: string | null;
	currentSnapshot: string | null; // base64 image
	controlMode: 'agent' | 'user';
	isActive: boolean;
}

export class SharedBrowserChannel implements IServerChannel {
	constructor(private readonly service: ISharedBrowserMainService) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onDidUpdateState': return this.service.onDidUpdateState;
		}
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'createBrowserWindow': return this.service.createBrowserWindow();
			case 'navigate': return this.service.navigate(arg);
			case 'executeAction': return this.service.executeAction(arg);
			case 'captureSnapshot': return this.service.captureSnapshot();
			case 'getSnapshot': return this.service.getSnapshot();
			case 'setControlMode': return this.service.setControlMode(arg);
			case 'getState': return this.service.getState();
			case 'getHtmlContent': return this.service.getHtmlContent();
			case 'show': return this.service.show();
			case 'close': return this.service.close();
		}
		throw new Error(`Call not found: ${command}`);
	}
}

export class SharedBrowserChannelClient implements ISharedBrowserMainService {
	_serviceBrand: undefined;

	constructor(private readonly channel: IChannel) { }

	get onDidUpdateState(): Event<void> {
		return this.channel.listen('onDidUpdateState');
	}

	async createBrowserWindow(): Promise<void> {
		return this.channel.call('createBrowserWindow');
	}

	async navigate(url: string): Promise<void> {
		return this.channel.call('navigate', url);
	}

	async executeAction(action: BrowserAction): Promise<any> {
		return this.channel.call('executeAction', action);
	}

	async captureSnapshot(): Promise<string | null> {
		return this.channel.call('captureSnapshot');
	}

	async getSnapshot(): Promise<any> {
		return this.channel.call('getSnapshot');
	}

	async setControlMode(mode: 'agent' | 'user'): Promise<void> {
		return this.channel.call('setControlMode', mode);
	}

	async getState(): Promise<BrowserState> {
		return this.channel.call('getState') as Promise<BrowserState>;
	}

	async getHtmlContent(): Promise<string | null> {
		return this.channel.call('getHtmlContent') as Promise<string | null>;
	}

	async show(): Promise<void> {
		return this.channel.call('show');
	}

	async close(): Promise<void> {
		return this.channel.call('close');
	}
}

