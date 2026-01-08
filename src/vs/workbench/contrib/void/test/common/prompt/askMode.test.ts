/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { chat_systemMessage } from '../../../common/prompt/prompts.js';
import { ChatMode, AgentSuperpowerMode } from '../../../common/voidSettingsTypes.js';

suite('Ask Mode Test', () => {

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

	test('ask mode includes correct instructions in system message', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		// Verifica que o prompt inclui as instruções específicas do modo Ask
		assert.ok(
			systemMessage.includes('**ASK MODE ACTIVE**'),
			'System message should include ASK MODE ACTIVE instruction'
		);

		assert.ok(
			systemMessage.includes('Do not modify files or run tools unless explicitly requested by the user.'),
			'System message should include instruction to not modify files or run tools unless explicitly requested'
		);

		assert.ok(
			systemMessage.includes('Focus on providing clear, helpful answers'),
			'System message should include instruction to focus on providing answers'
		);
	});

	test('ask mode prevents execution of unsolicited actions', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		// Verifica que o modo Ask instrui explicitamente a não executar ações não solicitadas
		assert.ok(
			systemMessage.includes('Do not modify files or run tools unless explicitly requested by the user.'),
			'System message should explicitly prevent execution of unsolicited actions'
		);

		// Verifica que as instruções do Ask mode vêm depois das instruções gerais
		const askModeIndex = systemMessage.indexOf('**ASK MODE ACTIVE**');
		const alwaysUseToolsIndex = systemMessage.indexOf('ALWAYS use tools');
		
		// Se ambas estão presentes, as instruções do Ask mode devem vir depois
		// (e portanto ter precedência)
		if (alwaysUseToolsIndex !== -1 && askModeIndex !== -1) {
			assert.ok(
				askModeIndex > alwaysUseToolsIndex,
				'ASK MODE instructions should come after general agent instructions to override them'
			);
		}
	});

	test('ask mode does not include plan or debug mode instructions', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		// Verifica que não inclui instruções de outros modos
		assert.ok(
			!systemMessage.includes('**PLAN MODE ACTIVE**'),
			'System message should not include PLAN MODE instructions when ask mode is active'
		);

		assert.ok(
			!systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'System message should not include DEBUG MODE instructions when ask mode is active'
		);
	});

	test('ask mode works in agent mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'agent' as ChatMode,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		assert.ok(
			systemMessage.includes('**ASK MODE ACTIVE**'),
			'Ask mode should work in agent mode'
		);
	});

	test('ask mode works in multi-agent mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'multi-agent' as ChatMode,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		assert.ok(
			systemMessage.includes('**ASK MODE ACTIVE**'),
			'Ask mode should work in multi-agent mode'
		);
	});

	test('ask mode is not applied in normal mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'normal' as ChatMode,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		// Em modo normal, não deve incluir instruções do modo Ask
		assert.ok(
			!systemMessage.includes('**ASK MODE ACTIVE**'),
			'Ask mode should not be applied in normal mode'
		);
	});

	test('ask mode is not applied when agentSuperpowerMode is null', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: null,
		});

		assert.ok(
			!systemMessage.includes('**ASK MODE ACTIVE**'),
			'Ask mode should not be applied when agentSuperpowerMode is null'
		);
	});

	test('ask mode emphasizes answering over executing', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'ask' as AgentSuperpowerMode,
		});

		// Verifica que o modo Ask enfatiza responder perguntas
		assert.ok(
			systemMessage.includes('Answer questions directly'),
			'System message should emphasize answering questions directly'
		);

		assert.ok(
			systemMessage.includes('without executing actions'),
			'System message should emphasize not executing actions'
		);
	});
});

