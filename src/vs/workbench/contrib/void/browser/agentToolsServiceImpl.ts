/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAgentToolsService } from '../common/agentToolsService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IToolsService } from './toolsService.js';

export class AgentToolsServiceImpl extends Disposable implements IAgentToolsService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IToolsService private readonly _realToolsService: IToolsService,
	) {
		super();
	}

	/**
	 * Retorna o ToolsService real injetado
	 */
	private async _getToolsService(): Promise<IToolsService> {
		return this._realToolsService;
	}

	async runToolGeneric(toolName: string, params: RawToolParamsObj): Promise<Record<string, unknown>> {
		const toolId = generateUuid();
		const startTime = Date.now();

		this.logService.info(`[AgentToolsService] runToolGeneric "${toolName}" started (id: ${toolId})`);

		try {
			const toolsService = await this._getToolsService();
			const toolFn = (toolsService.callTool as any)[toolName];
			
			if (!toolFn || typeof toolFn !== 'function') {
				this.logService.warn(`[AgentToolsService] Tool "${toolName}" not found`);
				return {
					success: false,
					toolId,
					error: `Tool "${toolName}" not available`,
					message: `Tool "${toolName}" called but not found in service`
				};
			}

			// Executar a ferramenta
			this.logService.info(`[AgentToolsService] Executing tool "${toolName}" with params: ${JSON.stringify(params)}`);
			const toolRes = await toolFn(params);
			const result = await toolRes.result;
			
			const duration = Date.now() - startTime;
			this.logService.info(`[AgentToolsService] runToolGeneric "${toolName}" completed in ${duration}ms (id: ${toolId})`);

			// Formatar o resultado para o orquestrador
			return {
				success: true,
				toolId,
				duration,
				result
			};
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logService.error(`[AgentToolsService] runToolGeneric "${toolName}" failed after ${duration}ms: ${error}`);

			return {
				success: false,
				toolId,
				duration,
				error: String(error),
			};
		}
	}

	hasTool(toolName: string): boolean {
		// Lista de ferramentas conhecidas
		const knownTools = [
			'read_file', 'edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder',
			'ls_dir', 'get_dir_tree', 'search_pathnames_only', 'search_for_files', 'search_in_file', 'read_lint_errors',
			'run_command', 'open_persistent_terminal', 'run_persistent_command', 'kill_persistent_terminal',
			'browser_navigate', 'browser_click', 'browser_type', 'browser_snapshot', 'browser_screenshot',
			'browser_hover', 'browser_press_key', 'browser_select_option', 'browser_wait_for', 'browser_show', 'browser_scroll'
		];
		return knownTools.includes(toolName);
	}

	getAvailableTools(): string[] {
		return [
			'read_file', 'edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder',
			'ls_dir', 'get_dir_tree', 'search_pathnames_only', 'search_for_files', 'search_in_file', 'read_lint_errors',
			'run_command', 'open_persistent_terminal', 'run_persistent_command', 'kill_persistent_terminal',
			'browser_navigate', 'browser_click', 'browser_type', 'browser_snapshot', 'browser_screenshot',
			'browser_hover', 'browser_press_key', 'browser_select_option', 'browser_wait_for', 'browser_show', 'browser_scroll'
		];
	}

	async isInitialized(): Promise<boolean> {
		return !!this._realToolsService;
	}

	override dispose(): void {
		super.dispose();
	}
}

registerSingleton(IAgentToolsService, AgentToolsServiceImpl, InstantiationType.Eager);