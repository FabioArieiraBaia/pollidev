/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ToolMessage } from '../../common/chatThreadServiceTypes.js';
import { ToolName } from '../../common/toolsServiceTypes.js';

suite('Shared Browser Service Test', () => {
	const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();

	// Mock do serviço de settings
	const mockSettingsService = {
		state: {
			globalSettings: {
				sharedBrowserEnabled: false,
			},
		},
		onDidChangeState: () => ({ dispose: () => { } }),
	};

	// Mock do serviço de log
	const mockLogService = {
		info: () => {},
		error: () => {},
		trace: () => {},
		warn: () => {},
	};

	// Mock do serviço de main process (IPC)
	const mockMainProcessService = {
		getChannel: () => ({
			call: async () => ({}),
			listen: () => ({ dispose: () => {} }),
		}),
	};

	// Mock do serviço de webview workbench
	const mockWebviewWorkbenchService = {
		openWebview: () => ({
			webview: {
				html: '',
				cspSource: 'vscode-webview://',
				onDidReceiveMessage: () => ({ dispose: () => {} }),
			},
			isDisposed: false,
		}),
		revealWebview: () => {},
		iconManager: {} as any,
		onDidChangeActiveWebviewEditor: () => ({ dispose: () => {} }),
		registerResolver: () => ({ dispose: () => {} }),
		shouldPersist: () => false,
		resolveWebview: async () => {},
		openRevivedWebview: () => ({ webview: { html: '', cspSource: '', onDidReceiveMessage: () => ({ dispose: () => {} }) }, isDisposed: false }),
	};

	// Mock do serviço de análise de DOM
	const mockDomAnalysisService = {
		processBrowserSnapshot: () => ({ elements: [], buttons: [], links: [], inputs: [] }),
		flattenSnapshot: () => [],
	};

	// Mock do detector de padrões
	const mockPagePatternDetector = {
		detectPattern: () => ({ type: 'unknown' }),
		detectPatterns: () => [{ type: 'unknown' }],
	};

	test('service opens automatically when browser tool is called', async () => {
		// Import dinâmico para evitar problemas de inicialização
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		// Verifica que o serviço inicia fechado
		assert.strictEqual(service.state.isActive, false, 'Service should start inactive');

		// Simula uma chamada de ferramenta do navegador
		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_navigate'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_navigate',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: { url: 'https://example.com' },
			mcpServerName: 'cursor-ide-browser',
		};

		await service.handleBrowserToolCall(toolCall);

		// Verifica que o serviço foi aberto automaticamente
		assert.strictEqual(service.state.isActive, true, 'Service should open automatically when browser tool is called');
	});

	test('service registers navigate action correctly', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_navigate'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_navigate',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: { url: 'https://example.com' },
			mcpServerName: 'cursor-ide-browser',
		};

		await service.handleBrowserToolCall(toolCall);

		const state = service.state;
		assert.strictEqual(state.currentUrl, 'https://example.com', 'Current URL should be set');
		assert.strictEqual(state.actionHistory.length, 1, 'Action history should have one action');
		assert.strictEqual(state.actionHistory[0].type, 'navigate', 'Action type should be navigate');
		assert.strictEqual(state.actionHistory[0].url, 'https://example.com', 'Action URL should match');
	});

	test('service registers click action correctly', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_click'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_click',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: { element: 'button#submit', ref: 'ref-123' },
			mcpServerName: 'cursor-ide-browser',
		};

		await service.handleBrowserToolCall(toolCall);

		const state = service.state;
		assert.strictEqual(state.actionHistory.length, 1, 'Action history should have one action');
		assert.strictEqual(state.actionHistory[0].type, 'click', 'Action type should be click');
		assert.ok(
			state.actionHistory[0].description.includes('button#submit') || 
			state.actionHistory[0].description.includes('ref-123'),
			'Action description should include element reference'
		);
	});

	test('service registers type action correctly', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_type'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_type',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: { element: 'input#search', text: 'Hello World' },
			mcpServerName: 'cursor-ide-browser',
		};

		await service.handleBrowserToolCall(toolCall);

		const state = service.state;
		assert.strictEqual(state.actionHistory.length, 1, 'Action history should have one action');
		assert.strictEqual(state.actionHistory[0].type, 'type', 'Action type should be type');
		assert.strictEqual(state.actionHistory[0].text, 'Hello World', 'Action text should match');
		assert.ok(
			state.actionHistory[0].description.includes('Hello World'),
			'Action description should include typed text'
		);
	});

	test('service updates snapshot when result contains image data', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_take_screenshot'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_take_screenshot',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'image', image: { data: mockImageData, mimeType: 'image/png' } }] } as any,
			rawParams: {},
			mcpServerName: 'cursor-ide-browser',
		};

		await service.handleBrowserToolCall(toolCall);

		const state = service.state;
		// O resultado pode estar em result.content[0].image.data
		const snapshotValue = (toolCall.result as any)?.content?.[0]?.image?.data || mockImageData;
		assert.strictEqual(state.currentSnapshot, snapshotValue, 'Snapshot should be updated with image data');
		assert.strictEqual(state.actionHistory.length, 1, 'Action history should have one action');
		assert.strictEqual(state.actionHistory[0].type, 'screenshot', 'Action type should be screenshot');
	});

	test('service fires update events when state changes', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		let updateCount = 0;
		const disposable = service.onDidUpdateState(() => {
			updateCount++;
		});
		testDisposables.add(disposable);

		// Abrir deve disparar evento
		service.open();
		assert.strictEqual(updateCount, 1, 'Should fire event when opening');

		// Adicionar ação deve disparar evento
		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_navigate'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_navigate',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: { url: 'https://example.com' },
			mcpServerName: 'cursor-ide-browser',
		};
		await service.handleBrowserToolCall(toolCall);
		assert.strictEqual(updateCount, 2, 'Should fire event when handling tool call');

		// Fechar deve disparar evento
		service.close();
		assert.strictEqual(updateCount, 3, 'Should fire event when closing');
	});

	test('service limits action history to 100 actions', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		// Adiciona 101 ações
		for (let i = 0; i < 101; i++) {
			const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_click'> = {
				role: 'tool',
				type: 'success',
				name: 'mcp_cursor-ide-browser_browser_click',
				id: `test-id-${i}`,
				content: '',
				params: {},
				result: { content: [{ type: 'text', text: '' }] } as any,
				rawParams: { element: `button-${i}` },
				mcpServerName: 'cursor-ide-browser',
			};
			await service.handleBrowserToolCall(toolCall);
		}

		const state = service.state;
		assert.strictEqual(state.actionHistory.length, 100, 'Action history should be limited to 100 actions');
		// A primeira ação (índice 0) deve ser removida
		assert.ok(
			!state.actionHistory[0].element?.includes('button-0'),
			'First action should be removed'
		);
		// A última ação deve ser a mais recente
		assert.ok(
			state.actionHistory[state.actionHistory.length - 1].element?.includes('button-100'),
			'Last action should be the most recent'
		);
	});

	test('service handles all browser tool types', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		const toolTypes = [
			{ name: 'mcp_cursor-ide-browser_browser_navigate', expectedType: 'navigate' },
			{ name: 'mcp_cursor-ide-browser_browser_click', expectedType: 'click' },
			{ name: 'mcp_cursor-ide-browser_browser_type', expectedType: 'type' },
			{ name: 'mcp_cursor-ide-browser_browser_snapshot', expectedType: 'snapshot' },
			{ name: 'mcp_cursor-ide-browser_browser_take_screenshot', expectedType: 'screenshot' },
			{ name: 'mcp_cursor-ide-browser_browser_hover', expectedType: 'hover' },
		];

		for (const toolType of toolTypes) {
			const toolCall: ToolMessage<ToolName> = {
				role: 'tool',
				type: 'success',
				name: toolType.name as ToolName,
				id: 'test-id',
				content: '',
				params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: toolType.expectedType === 'navigate' ? { url: 'https://example.com' } : {},
				mcpServerName: 'cursor-ide-browser',
			};
			await service.handleBrowserToolCall(toolCall);
		}

		const state = service.state;
		assert.strictEqual(state.actionHistory.length, toolTypes.length, 'All tool types should be registered');
		
		// Verifica que todos os tipos estão presentes
		const registeredTypes = state.actionHistory.map((a: any) => a.type);
		for (const toolType of toolTypes) {
			assert.ok(
				registeredTypes.includes(toolType.expectedType as any),
				`Action type ${toolType.expectedType} should be registered`
			);
		}
	});

	test('service clears state when closed', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		// Adiciona algumas ações
		const toolCall: ToolMessage<'mcp_cursor-ide-browser_browser_navigate'> = {
			role: 'tool',
			type: 'success',
			name: 'mcp_cursor-ide-browser_browser_navigate',
			id: 'test-id',
			content: '',
			params: {},
			result: { content: [{ type: 'text', text: '' }] } as any,
			rawParams: { url: 'https://example.com' },
			mcpServerName: 'cursor-ide-browser',
		};
		await service.handleBrowserToolCall(toolCall);

		// Fecha o serviço
		service.close();

		const state = service.state;
		assert.strictEqual(state.isActive, false, 'Service should be inactive after closing');
		assert.strictEqual(state.currentUrl, null, 'Current URL should be cleared');
		assert.strictEqual(state.currentSnapshot, null, 'Snapshot should be cleared');
		assert.strictEqual(state.actionHistory.length, 0, 'Action history should be cleared');
	});

	test('service state is immutable (defensive copy)', async () => {
		const { SharedBrowserService } = await import('../../common/sharedBrowserService.js');
		
		const service = new SharedBrowserService(
			mockLogService as any,
			mockSettingsService as any,
			mockMainProcessService as any,
			mockWebviewWorkbenchService as any,
			mockDomAnalysisService as any,
			mockPagePatternDetector as any
		);
		testDisposables.add(service);

		service.open();

		const state1 = service.state;
		const state2 = service.state;

		// Modificar state1 não deve afetar state2 (são cópias diferentes)
		state1.actionHistory.push({} as any);

		assert.strictEqual(
			state2.actionHistory.length,
			state1.actionHistory.length - 1,
			'State copies should be independent'
		);
	});
});

