/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { chat_systemMessage } from '../../../common/prompt/prompts.js';
import { ChatMode, AgentSuperpowerMode } from '../../../common/voidSettingsTypes.js';

suite('Plan Mode Test', () => {

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

	test('plan mode includes correct instructions in system message', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'plan' as AgentSuperpowerMode,
		});

		// Verifica que o prompt inclui as instruções específicas do modo Plan
		assert.ok(
			systemMessage.includes('**PLAN MODE ACTIVE**: You MUST create a detailed step-by-step plan BEFORE executing any actions.'),
			'System message should include PLAN MODE ACTIVE instruction'
		);

		assert.ok(
			systemMessage.includes('Present the plan in a numbered checklist format using markdown.'),
			'System message should include instruction to present plan in numbered checklist format'
		);

		assert.ok(
			systemMessage.includes('ONLY after presenting the plan and getting implicit approval (user not stopping you), proceed to execute each task from your checklist, marking them as completed as you go.'),
			'System message should include instruction to wait for approval before executing'
		);

		assert.ok(
			systemMessage.includes('If the task is complex or has multiple steps, break it down into smaller sub-tasks in your checklist.'),
			'System message should include instruction to break down complex tasks'
		);
	});

	test('plan mode does not include debug or ask mode instructions', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: 'plan' as AgentSuperpowerMode,
		});

		// Verifica que não inclui instruções de outros modos
		assert.ok(
			!systemMessage.includes('**DEBUG MODE ACTIVE**'),
			'System message should not include DEBUG MODE instructions when plan mode is active'
		);

		assert.ok(
			!systemMessage.includes('**ASK MODE ACTIVE**'),
			'System message should not include ASK MODE instructions when plan mode is active'
		);
	});

	test('plan mode works in agent mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'agent' as ChatMode,
			agentSuperpowerMode: 'plan' as AgentSuperpowerMode,
		});

		assert.ok(
			systemMessage.includes('**PLAN MODE ACTIVE**'),
			'Plan mode should work in agent mode'
		);
	});

	test('plan mode works in multi-agent mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'multi-agent' as ChatMode,
			agentSuperpowerMode: 'plan' as AgentSuperpowerMode,
		});

		assert.ok(
			systemMessage.includes('**PLAN MODE ACTIVE**'),
			'Plan mode should work in multi-agent mode'
		);
	});

	test('plan mode is not applied in normal mode', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			chatMode: 'normal' as ChatMode,
			agentSuperpowerMode: 'plan' as AgentSuperpowerMode,
		});

		// Em modo normal, não deve incluir instruções do modo Plan
		assert.ok(
			!systemMessage.includes('**PLAN MODE ACTIVE**'),
			'Plan mode should not be applied in normal mode'
		);
	});

	test('plan mode is not applied when agentSuperpowerMode is null', () => {
		const systemMessage = chat_systemMessage({
			...defaultParams,
			agentSuperpowerMode: null,
		});

		assert.ok(
			!systemMessage.includes('**PLAN MODE ACTIVE**'),
			'Plan mode should not be applied when agentSuperpowerMode is null'
		);
	});
});

