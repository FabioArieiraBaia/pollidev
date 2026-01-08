/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { chat_systemMessage } from '../../../common/prompt/prompts.js';
import { ChatMode, AgentSuperpowerMode } from '../../../common/voidSettingsTypes.js';

suite('Debug Mode Test', () => {

	const defaultParams = {
		workspaceFolders: ['/workspace'],
		openedURIs: [],
		activeURI: undefined,
		persistentTerminalIDs: [],
		directoryStr: '',
		chatMode: 'agent' as ChatMode,
		mcpTools: undefined,
		includeXMLToolDefinitions: false,
	};

	test('debug mode includes correct instructions in system message', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'debug' as AgentSuperpowerMode,
		});

		// Verifica que o prompt inclui as instruções específicas do modo Debug
		assert.ok(
			systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'System message should include DEBUG MODE ACTIVE instruction'
		);

		assert.ok(
			systemMessage.includes('Analyze error messages carefully before proposing fixes.'),
			'System message should include instruction to analyze error messages carefully'
		);

		assert.ok(
			systemMessage.includes('Use tools to read relevant code files before suggesting changes.'),
			'System message should include instruction to read relevant code files before suggesting changes'
		);

		assert.ok(
			systemMessage.includes('Always take a snapshot or read the error context before attempting fixes.'),
			'System message should include instruction to take snapshot or read error context before fixes'
		);
	});

	test('debug mode does not include plan or ask mode instructions', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'debug' as AgentSuperpowerMode,
		});

		// Verifica que não inclui instruções de outros modos
		assert.ok(
			!systemMessage.includes('**PLAN MODE ACTIVE**'),
			'System message should not include PLAN MODE instructions when debug mode is active'
		);

		assert.ok(
			!systemMessage.includes('**ASK MODE ACTIVE**'),
			'System message should not include ASK MODE instructions when debug mode is active'
		);
	});

	test('debug mode works in agent mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'agent' as ChatMode,
			agentSuperpowerMode: 'debug' as AgentSuperpowerMode,
		});

		assert.ok(
			systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'Debug mode should work in agent mode'
		);
	});

	test('debug mode works in multi-agent mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'multi-agent' as ChatMode,
			agentSuperpowerMode: 'debug' as AgentSuperpowerMode,
		});

		assert.ok(
			systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'Debug mode should work in multi-agent mode'
		);
	});

	test('debug mode is not applied in normal mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'normal' as ChatMode,
			agentSuperpowerMode: 'debug' as AgentSuperpowerMode,
		});

		// Em modo normal, não deve incluir instruções do modo Debug
		assert.ok(
			!systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'Debug mode should not be applied in normal mode'
		);
	});

	test('debug mode is not applied when agentSuperpowerMode is null', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: null,
		});

		assert.ok(
			!systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'Debug mode should not be applied when agentSuperpowerMode is null'
		);
	});

	test('debug mode focuses on error identification and fixing', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'debug' as AgentSuperpowerMode,
		});

		// Verifica que o modo Debug enfatiza identificação e correção de erros
		const hasErrorFocus = systemMessage.includes('identifying and fixing errors') ||
			systemMessage.includes('Focus on identifying and fixing errors');
		
		assert.ok(
			hasErrorFocus,
			'Debug mode should focus on identifying and fixing errors'
		);

		// Verifica que enfatiza análise cuidadosa
		const hasCarefulAnalysis = systemMessage.includes('Analyze error messages carefully') ||
			systemMessage.includes('carefully before proposing fixes');
		
		assert.ok(
			hasCarefulAnalysis,
			'Debug mode should emphasize careful analysis of error messages'
		);

		// Verifica que enfatiza usar ferramentas para ler código relevante
		const hasToolUsage = systemMessage.includes('Use tools to read relevant code files') ||
			systemMessage.includes('read relevant code files before suggesting changes');
		
		assert.ok(
			hasToolUsage,
			'Debug mode should emphasize using tools to read relevant code files'
		);
	});
});

