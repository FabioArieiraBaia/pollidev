/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { RawToolParamsObj } from './sendLLMMessageTypes.js';

/**
 * Interface para integração de ferramentas no sistema multi-agente
 * Esta interface é definida em 'common' para evitar dependências circulares
 * A implementação real está em 'browser' e é carregada via dynamic import
 */
export const IAgentToolsService = createDecorator<IAgentToolsService>('AgentToolsService');

export interface IAgentToolsService {
	readonly _serviceBrand: undefined;

	/**
	 * Executa uma ferramenta e retorna o resultado
	 * @param toolName Nome da ferramenta (ex: 'read_file', 'edit_file', 'run_command')
	 * @param params Parâmetros da ferramenta
	 * @returns Resultado da execução da ferramenta
	 */
	runToolGeneric(toolName: string, params: RawToolParamsObj): Promise<Record<string, unknown>>;

	/**
	 * Verifica se uma ferramenta existe
	 */
	hasTool(toolName: string): boolean;

	/**
	 * Lista todas as ferramentas disponíveis
	 */
	getAvailableTools(): string[];
}