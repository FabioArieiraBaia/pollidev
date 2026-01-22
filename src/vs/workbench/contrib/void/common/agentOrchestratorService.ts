/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { AgentPlan, AgentTask, AgentContext, AgentMessage, MultiAgentSettings, AgentRole } from './multiAgentTypes.js';
import { ChatMode, ModelSelection, OverridesOfModel } from './voidSettingsTypes.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { ILLMMessageService } from './sendLLMMessageService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { LLMChatMessage, RawToolParamsObj } from './sendLLMMessageTypes.js';
import { IAgentToolsService } from './agentToolsService.js';

export const IAgentOrchestratorService = createDecorator<IAgentOrchestratorService>('AgentOrchestratorService');

export interface IAgentOrchestratorService {
	readonly _serviceBrand: undefined;

	processRequest(request: string, threadId: string, chatMode: ChatMode): Promise<void>;
	getContext(threadId: string): AgentContext | undefined;
	cancelPlan(threadId: string): void;
	createPlanFromChecklist(checklist: AgentTask[], threadId: string, originalRequest: string): AgentPlan;
	updateTaskAssignment(threadId: string, taskId: string, agentModel: string): void;
	executeSelectedTasks(threadId: string, taskIds: string[]): Promise<void>;
	refinePlan(threadId: string, userEdits: Partial<AgentTask>[]): void;
	addAgentMessage(threadId: string, message: Omit<AgentMessage, 'timestamp'>): void;
	executeTool(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class AgentOrchestratorService extends Disposable implements IAgentOrchestratorService {
	declare readonly _serviceBrand: undefined;

	private readonly _contexts = new Map<string, AgentContext>();
	private readonly _activePlans = new Map<string, AgentPlan>();
	private readonly _toolResults = new Map<string, Record<string, unknown>>();

	constructor(
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
		@ILogService private readonly logService: ILogService,
		@IAgentToolsService private readonly agentToolsService: IAgentToolsService,
	) {
		super();
	}

	async processRequest(request: string, threadId: string, chatMode: ChatMode): Promise<void> {
		if (chatMode !== 'multi-agent') {
			throw new Error('AgentOrchestratorService should only be used with multi-agent mode');
		}

		const settings = this.voidSettingsService.state.globalSettings.multiAgentSettings;
		if (!settings.enabled) {
			throw new Error('Multi-agent system is not enabled');
		}

		if (!this._contexts.has(threadId)) {
			this._contexts.set(threadId, {
				sharedHistory: [],
				workspaceState: {
					filesModified: [],
					commandsExecuted: [],
					errors: [],
				},
			});
		}

		const context = this._contexts.get(threadId)!;

		this.addAgentMessage(threadId, {
			from: 'orchestrator' as AgentRole,
			to: 'all' as AgentRole,
			content: `👤 **User Request**\n\n${request}`,
			taskId: undefined,
		});

		const needsPlanning = this._orchestratorAnalyze(request, context, settings);

		if (needsPlanning) {
			const plan = this._plannerCreatePlan(request, context, settings);
			context.currentPlan = plan;
			this._activePlans.set(threadId, plan);

			this.addAgentMessage(threadId, {
				from: 'planner' as AgentRole,
				to: 'orchestrator' as AgentRole,
				content: `📋 **Plano Criado**\n\nO planner criou um plano com ${plan.tasks.length} tarefas:\n\n${
					plan.tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n')
				}`,
				taskId: undefined,
			});

			await this._executePlan(plan, context, settings, threadId);
		} else {
			await this._executeDirect(request, context, settings, threadId);
		}
	}

	private _orchestratorAnalyze(
		request: string,
		context: AgentContext,
		settings: MultiAgentSettings
	): boolean {
		const complexIndicators = [
			'refatorar', 'refactor', 'criar múltiplos', 'create multiple',
			'implementar recurso', 'implement feature',
			'sistema completo', 'complete system',
			'arquitetura', 'architecture',
			'renomear arquivos', 'rename files',
			'migrar', 'migrate',
			'integrar', 'integrate',
			'correção completa', 'full fix',
			'criar componente', 'create component',
			'configurar', 'configure',
			'desenvolver', 'develop',
			'teste', 'test', 'testing',
		];

		const isComplex = complexIndicators.some(indicator => 
			request.toLowerCase().includes(indicator.toLowerCase())
		);

		const wordCount = request.split(/\s+/).length;
		const isLongRequest = wordCount > 15;

		return isComplex || isLongRequest || context.currentPlan === undefined;
	}

	private _plannerCreatePlan(
		request: string,
		context: AgentContext,
		settings: MultiAgentSettings
	): AgentPlan {
		const planId = generateUuid();
		const tasks: AgentTask[] = [];

		const planningResult = this._generateTasksFromRequest(request, context);
		tasks.push(...planningResult);

		return {
			id: planId,
			originalRequest: request,
			tasks,
			createdAt: Date.now(),
			status: 'ready',
		};
	}

	private _generateTasksFromRequest(request: string, _context: AgentContext): AgentTask[] {
		const tasks: AgentTask[] = [];
		const requestLower = request.toLowerCase();

		const patterns = [
			{ keywords: ['criar', 'create', 'novo', 'new'], task: { description: 'Criar arquivo ou componente necessário', type: 'create' } },
			{ keywords: ['editar', 'edit', 'modificar', 'modify', 'alterar', 'change'], task: { description: 'Modificar arquivos existentes', type: 'edit' } },
			{ keywords: ['ler', 'read', 'verificar', 'check', 'analisar', 'analyze'], task: { description: 'Analisar arquivos existentes', type: 'read' } },
			{ keywords: ['instalar', 'install', 'npm', 'yarn', 'depend'], task: { description: 'Instalar dependências necessárias', type: 'terminal' } },
			{ keywords: ['testar', 'test', 'testing', 'spec'], task: { description: 'Executar testes', type: 'test' } },
			{ keywords: ['build', 'compilar', 'compile', 'bundl'], task: { description: 'Build do projeto', type: 'build' } },
			{ keywords: ['refatorar', 'refactor', 'melhorar', 'improve'], task: { description: 'Refatorar código', type: 'refactor' } },
			{ keywords: ['corrigir', 'fix', 'bug', 'erro', 'error'], task: { description: 'Corrigir problemas identificados', type: 'fix' } },
			{ keywords: ['navegar', 'browser', 'internet', 'site', 'pesquisar', 'search'], task: { description: 'Navegar na internet e buscar informações', type: 'browser' } },
		];

		const identifiedTypes = new Set<string>();
		for (const pattern of patterns) {
			if (pattern.keywords.some(kw => requestLower.includes(kw))) {
				identifiedTypes.add(pattern.task.type);
			}
		}

		if (identifiedTypes.size === 0) {
			tasks.push({
				id: generateUuid(),
				description: `Analisar e responder: ${request.substring(0, 100)}...`,
				assignedTo: 'executor' as AgentRole,
				status: 'pending' as const,
				createdAt: Date.now(),
			});
		} else {
			const typeDescriptions: Record<string, string> = {
				'create': 'Criar novos arquivos ou componentes',
				'edit': 'Modificar arquivos existentes',
				'read': 'Analisar arquivos existentes',
				'terminal': 'Executar comandos no terminal',
				'test': 'Verificar testes',
				'build': 'Compilar/buildar o projeto',
				'refactor': 'Refatorar código existente',
				'fix': 'Corrigir bugs ou problemas',
				'browser': 'Navegar na internet e buscar informações',
			};

			for (const type of identifiedTypes) {
				tasks.push({
					id: generateUuid(),
					description: typeDescriptions[type] || `Tarefa: ${type}`,
					assignedTo: 'executor' as AgentRole,
					status: 'pending' as const,
					createdAt: Date.now(),
				});
			}
		}

		tasks.push({
			id: generateUuid(),
			description: 'Validar resultado e verificar se todos os requisitos foram atendidos',
			assignedTo: 'executor' as AgentRole,
			status: 'pending' as const,
			createdAt: Date.now(),
		});

		return tasks;
	}

	private async _executePlan(
		plan: AgentPlan,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		plan.status = 'executing';

		this.addAgentMessage(threadId, {
			from: 'orchestrator' as AgentRole,
			to: 'all' as AgentRole,
			content: `🚀 **Iniciando Execução do Plano**\n\n${plan.tasks.length} tarefas serão executadas${settings.enableParallelExecution ? ' em paralelo' : ' em sequência'}.\n\nModelos disponíveis: ${settings.executorModels.join(', ')}`,
			taskId: undefined,
		});

		if (settings.enableParallelExecution) {
			await this._executeParallel(plan, context, settings, threadId);
		} else {
			await this._executeSequential(plan, context, settings, threadId);
		}

		plan.status = 'completed';

		const completed = plan.tasks.filter(t => t.status === 'completed').length;
		const failed = plan.tasks.filter(t => t.status === 'failed').length;

		this.addAgentMessage(threadId, {
			from: 'orchestrator' as AgentRole,
			to: 'all' as AgentRole,
			content: `✅ **Plano Concluído**\n\nResultado:\n- Tarefas concluídas: ${completed}/${plan.tasks.length}\n- Falhas: ${failed}\n\nArquivos modificados: ${context.workspaceState.filesModified.length}\nComandos executados: ${context.workspaceState.commandsExecuted.length}`,
			taskId: undefined,
		});
	}

	private async _executeSequential(
		plan: AgentPlan,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		for (const task of plan.tasks) {
			if (plan.status === 'cancelled') break;
			
			if (task.status === 'pending') {
				const depsCompleted = this._checkDependencies(task, plan.tasks);
				if (!depsCompleted) {
					task.status = 'failed';
					task.error = 'Dependências não atendidas';
					continue;
				}
				
				await this._executeTask(task, context, settings, threadId);
			}
		}
	}

	private async _executeParallel(
		plan: AgentPlan,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		const getExecutableTasks = (): AgentTask[] => {
			return plan.tasks.filter(task => {
				if (task.status !== 'pending') return false;
				return this._checkDependencies(task, plan.tasks);
			});
		};

		let executableTasks = getExecutableTasks();
		
		while (executableTasks.length > 0 && plan.status !== 'cancelled') {
			const batch: AgentTask[] = [];
			const concurrentPromises: Promise<void>[] = [];

			for (let i = 0; i < Math.min(settings.maxConcurrentAgents, executableTasks.length); i++) {
				const task = executableTasks[i];
				batch.push(task);
				concurrentPromises.push(this._executeTask(task, context, settings, threadId));
			}

			await Promise.all(concurrentPromises);
			executableTasks = getExecutableTasks();
		}
	}

	private _checkDependencies(task: AgentTask, allTasks: AgentTask[]): boolean {
		if (!task.dependencies || task.dependencies.length === 0) return true;
		
		return task.dependencies.every(depId => {
			const depTask = allTasks.find(t => t.id === depId);
			return depTask && depTask.status === 'completed';
		});
	}

	private async _executeTask(
		task: AgentTask,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		task.status = 'in_progress';
		task.startedAt = Date.now();

		this.addAgentMessage(threadId, {
			from: task.assignedTo,
			to: 'orchestrator' as AgentRole,
			content: `🔄 **Iniciando Tarefa**\n\n${task.description}`,
			taskId: task.id,
		});

		try {
			const executorModel = this._selectExecutorModel(settings, task);
			task.model = executorModel;

			const result = await this._runAgentTask(task, context, executorModel, threadId);

			task.status = 'completed';
			task.completedAt = Date.now();
			task.result = result;

			const filesModified = result.filesModified as string[] | undefined;
			const commandsExecuted = result.commandsExecuted as string[] | undefined;
			const summary = result.summary as string | undefined;
			
			if (filesModified) {
				context.workspaceState.filesModified.push(...filesModified);
			}
			if (commandsExecuted) {
				context.workspaceState.commandsExecuted.push(...commandsExecuted);
			}

			this.addAgentMessage(threadId, {
				from: task.assignedTo,
				to: 'orchestrator' as AgentRole,
				content: `✅ **Tarefa Concluída**\n\n${task.description}\n\nResultado: ${summary || 'Concluído com sucesso'}\n\nArquivos modificados: ${filesModified?.join(', ') || 'Nenhum'}`,
				taskId: task.id,
			});

		} catch (error) {
			task.status = 'failed';
			task.error = error instanceof Error ? error.message : String(error);
			context.workspaceState.errors.push(task.error);

			this.addAgentMessage(threadId, {
				from: task.assignedTo,
				to: 'orchestrator' as AgentRole,
				content: `❌ **Tarefa Falhou**\n\n${task.description}\n\nErro: ${task.error}`,
				taskId: task.id,
			});
		}
	}

	private async _runAgentTask(
		task: AgentTask,
		context: AgentContext,
		executorModel: string,
		threadId: string
	): Promise<Record<string, unknown>> {
		const modelSelection = this._getModelSelectionForModel(executorModel);
		
		if (!modelSelection) {
			return {
				summary: `Tarefa "${task.description}" marcada como concluída (sem modelo configurado)`,
				filesModified: [],
				commandsExecuted: [],
			};
		}

		const systemMessage = this._createExecutorSystemMessage(task, context);
		const userMessage = this._createExecutorUserMessage(task, context);

		// Iniciar conversation history
		const messages: LLMChatMessage[] = [
			{ role: 'system', content: systemMessage } as LLMChatMessage,
			{ role: 'user', content: userMessage } as LLMChatMessage,
		];

		const maxIterations = 10;
		let iterations = 0;
		let lastResponse = '';

		while (iterations < maxIterations) {
			iterations++;
			this.logService.info(`[AgentOrchestrator] Iteration ${iterations}/${maxIterations} for task ${task.id}`);

			try {
				lastResponse = await this._callLLM({
					messages,
					modelSelection,
					chatMode: 'agent',
					threadId: threadId,
					timeout: 300000,
				});

				this.logService.info(`[AgentOrchestrator] LLM response (${lastResponse.length} chars): ${lastResponse.substring(0, 200)}...`);

				// Verificar se há tool calls na resposta
				const toolCall = this._parseToolCallFromResponse(lastResponse);

				if (toolCall) {
					this.logService.info(`[AgentOrchestrator] ✅ Detected tool call: ${toolCall.name}`);
					this.logService.info(`[AgentOrchestrator] Tool params: ${JSON.stringify(toolCall.params)}`);

					// Executar a ferramenta
					try {
						const toolResult = await this.agentToolsService.runToolGeneric(toolCall.name, toolCall.params as RawToolParamsObj);
						
						this.logService.info(`[AgentOrchestrator] Tool result: ${JSON.stringify(toolResult).substring(0, 200)}...`);

						// Adicionar tool call e resultado à conversa
						messages.push({ role: 'assistant', content: lastResponse } as LLMChatMessage);
						messages.push({ 
							role: 'user', 
							content: `Tool ${toolCall.name} result:\n${JSON.stringify(toolResult, null, 2)}` 
						} as LLMChatMessage);

						// Registrar no contexto
						if (toolCall.name === 'run_command') {
							context.workspaceState.commandsExecuted.push(String(toolCall.params?.command || 'unknown'));
						} else if (toolCall.name === 'create_file_or_folder' || toolCall.name === 'rewrite_file') {
							context.workspaceState.filesModified.push(String(toolCall.params?.uri || toolCall.params?.path || 'unknown'));
						}
					} catch (toolError) {
						this.logService.error(`[AgentOrchestrator] Tool execution failed: ${toolError}`);
						messages.push({ role: 'assistant', content: lastResponse } as LLMChatMessage);
						messages.push({ 
							role: 'user', 
							content: `Tool ${toolCall.name} FAILED with error: ${toolError}` 
						} as LLMChatMessage);
					}
				} else {
					// Não há mais tool calls, tarefa concluída
					this.logService.info(`[AgentOrchestrator] No tool call detected, task complete`);
					return this._parseTaskResult(lastResponse);
				}
			} catch (error) {
				this.logService.error(`[AgentOrchestrator] Task LLM call failed: ${error}`);
				return {
					summary: `Tarefa "${task.description}" concluída com erro no LLM`,
					filesModified: [],
					commandsExecuted: [],
					error: String(error),
				};
			}
		}

		this.logService.warn(`[AgentOrchestrator] Max iterations reached (${maxIterations})`);
		return this._parseTaskResult(lastResponse);
	}

	/**
	 * Detecta tool call na resposta do LLM - suporta formato XML e JSON
	 */
	private _parseToolCallFromResponse(response: string): { name: string; params: Record<string, unknown> } | null {
		// Formato XML: <tool_call>name</tool_call><tool_params>{...}</tool_params>
		const xmlMatch = response.match(/<tool_call>\s*([^<]+)\s*<\/tool_call>\s*<tool_params>\s*([\s\S]*?)\s*<\/tool_params>/i);
		if (xmlMatch) {
			this.logService.info(`[AgentOrchestrator] XML format detected: ${xmlMatch[1].trim()}`);
			try {
				return {
					name: xmlMatch[1].trim(),
					params: JSON.parse(xmlMatch[2]),
				};
			} catch (e) {
				this.logService.warn(`[AgentOrchestrator] XML params parse failed: ${e}`);
			}
		}

		// Formato JSON: {"tool": "name", "params": {...}}
		const jsonMatch = response.match(/\{?\s*"tool"\s*:\s*"([^"]+)"[^}]*params\s*:\s*(\{[\s\S]*?\})/i);
		if (jsonMatch) {
			this.logService.info(`[AgentOrchestrator] JSON format detected: ${jsonMatch[1]}`);
			try {
				return {
					name: jsonMatch[1],
					params: JSON.parse(jsonMatch[2]),
				};
			} catch (e) {
				this.logService.warn(`[AgentOrchestrator] JSON params parse failed: ${e}`);
			}
		}

		// Formato simples: TOOL_CALL: name=read_file, params={...}
		const simpleMatch = response.match(/TOOL_CALL:\s*name\s*=\s*(\w+)[,\s]*params\s*=\s*(\{[^}]+\})/i);
		if (simpleMatch) {
			this.logService.info(`[AgentOrchestrator] Simple format detected: ${simpleMatch[1]}`);
			try {
				return {
					name: simpleMatch[1],
					params: JSON.parse(simpleMatch[2]),
				};
			} catch (e) {
				this.logService.warn(`[AgentOrchestrator] Simple params parse failed: ${e}`);
			}
		}

		// Verificar se menciona uso de ferramenta (descrição em vez de formato estruturado)
		const descriptionMatch = response.match(/(?:I'll use|I will use|I'll call|I will call|Let me use|Using)\s+(\w+)\s*(?:to|for)/i);
		if (descriptionMatch) {
			this.logService.info(`[AgentOrchestrator] LLM mentions tool "${descriptionMatch[1]}" but NOT in structured format - will suggest format`);
			// Não é um tool call real, apenas uma descrição
			return null;
		}

		this.logService.debug(`[AgentOrchestrator] No tool call detected in response`);
		return null;
	}

	private _createExecutorSystemMessage(task: AgentTask, context: AgentContext): string {
		return `CRITICAL: TOOL CALL FORMAT REQUIRED

When you need to use a TOOL, you MUST output it in this EXACT XML format:

<tool_call>create_file</tool_call>
<tool_params>{"path": "C:/path/to/file.txt", "content": "file content"}</tool_params>

<tool_call>read_file</tool_call>
<tool_params>{"uri": "C:/path/to/file.txt"}</tool_params>

<tool_call>edit_file</tool_call>
<tool_params>{"uri": "C:/path/to/file.txt", "search_replace_blocks": "<<<<<<< ORIGINAL\ncode\n=======\nnew code\n

### Browser Automation (WEB NAVIGATION!)
- browser_navigate: Navigate to URL
- browser_click: Click element
- browser_type: Type text
- browser_snapshot: Take accessibility snapshot
- browser_screenshot: Take screenshot
- browser_hover: Hover element
- browser_press_key: Press key
- browser_select_option: Select dropdown option
- browser_wait_for: Wait for text/time

## Instructions
1. COMPLETE THE TASK using available tools
2. For FILES: Use read_file, edit_file, rewrite_file, create_file_or_folder
3. For SEARCH: Use search_pathnames_only, search_for_files, ls_dir
4. For TERMINAL: Use run_command for npm install, git, build, etc.
5. For WEB BROWSING: Use browser_navigate, browser_snapshot, browser_click, browser_type
6. Report progress clearly
7. When finished, provide a clear summary with TOOL RESULTS

When you need to use a tool, simply describe what tool you would use in your response - the system will call it for you.

IMPORTANT: You CAN and SHOULD use tools! Don't just describe - the tools will be called!
`;
	}

	private _createExecutorUserMessage(task: AgentTask, context: AgentContext): string {
		return `## Task to Complete
${task.description}

## Previous Tasks in Plan
${context.currentPlan?.tasks.filter(t => t.id !== task.id).map((t, i) => 
	`${i + 1}. [${t.status}] ${t.description}`
).join('\n') || 'None'}

## Files Modified So Far
${context.workspaceState.filesModified.length > 0 ? context.workspaceState.filesModified.join(', ') : 'None'}

## Commands Executed
${context.workspaceState.commandsExecuted.length > 0 ? context.workspaceState.commandsExecuted.join(', ') : 'None'}

## IMPORTANT:
Please complete this task. You have access to ALL tools via the XML tool call format shown in the system message. The system will EXTRACT and EXECUTE tool calls from your XML-formatted response automatically.

Provide a summary of what you ACCOMPLISHED including:
- Files created or modified (with paths)
- Commands executed
- Browser navigation performed
- Any errors encountered

If you need more information to complete the task, explain what you need.
`;
	}

	private _parseTaskResult(result: string): Record<string, unknown> {
		const summaryMatch = result.match(/TASK COMPLETE[:\s]*(.+)/i);
		const filesMatch = result.match(/Files?[-\s]*(?:created|modified)[:\s]*(.+)/i);
		const commandsMatch = result.match(/Commands?[:\s]*(.+)/i);
		const browserMatch = result.match(/Browser[:\s]*(.+)/i);
		
		return {
			summary: summaryMatch ? summaryMatch[1].trim() : result.substring(0, 300),
			filesModified: filesMatch ? filesMatch[1].split(/[,;\n]/).map(f => f.trim()).filter(Boolean) : [],
			commandsExecuted: commandsMatch ? commandsMatch[1].split(/[,;\n]/).map(c => c.trim()).filter(Boolean) : [],
			browserActions: browserMatch ? [browserMatch[1].trim()] : [],
			fullResult: result,
		};
	}

	private async _executeDirect(
		request: string,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		const task: AgentTask = {
			id: generateUuid(),
			description: request,
			assignedTo: 'executor' as AgentRole,
			status: 'pending' as const,
			createdAt: Date.now(),
		};

		await this._executeTask(task, context, settings, threadId);
	}

	private _selectExecutorModel(settings: MultiAgentSettings, task: AgentTask): string {
		const models = settings.executorModels;
		if (models.length === 0) {
			return 'gemini-fast';
		}

		const complexityIndicators = ['refatorar', 'refactor', 'arquitetura', 'architecture', 'sistema', 'system', 'integração', 'integration'];
		
		const isComplex = complexityIndicators.some(ind => task.description.toLowerCase().includes(ind.toLowerCase()));

		if (isComplex && models.length > 1) {
			return models[0];
		}

		return models[models.length - 1];
	}

	private _getModelSelectionForModel(modelName: string): ModelSelection | null {
		const modelSelectionOfFeature = this.voidSettingsService.state.modelSelectionOfFeature;
		const settingsOfProvider = this.voidSettingsService.state.settingsOfProvider;

		const providers = Object.keys(settingsOfProvider) as Array<keyof typeof settingsOfProvider>;
		
		for (const providerName of providers) {
			const provider = settingsOfProvider[providerName];
			const model = provider.models.find(m => m.modelName === modelName && !m.isHidden);
			if (model) {
				return { providerName, modelName };
			}
		}

		return modelSelectionOfFeature['Chat'] || null;
	}

	private async _callLLM(params: {
		messages: LLMChatMessage[];
		modelSelection: ModelSelection | null;
		chatMode: ChatMode;
		threadId: string;
		timeout: number;
	}): Promise<string> {
		return new Promise((resolve, reject) => {
			let streamingText = '';
			let hasText = false;
			
			const timeoutId = setTimeout(() => {
				this.logService.error(`[AgentOrchestrator] LLM call timeout after ${params.timeout}ms. Has text: ${hasText}`);
				reject(new Error('LLM call timeout'));
			}, params.timeout);

			const startTime = Date.now();
			this.logService.info(`[AgentOrchestrator] Starting LLM call to model: ${params.modelSelection?.modelName || 'unknown'}`);

			const requestId = this.llmMessageService.sendLLMMessage({
				messagesType: 'chatMessages',
				chatMode: params.chatMode,
				messages: params.messages,
				modelSelection: params.modelSelection,
				modelSelectionOptions: undefined,
				overridesOfModel: {} as unknown as OverridesOfModel,
				logging: { 
					loggingName: `MultiAgent-${params.chatMode}`, 
					loggingExtras: { threadId: params.threadId } 
				},
				separateSystemMessage: undefined,
				onText: (text) => {
					if (text) {
						streamingText += text;
						hasText = true;
					}
				},
				onFinalMessage: async ({ fullText }) => {
					clearTimeout(timeoutId);
					const duration = Date.now() - startTime;
					this.logService.info(`[AgentOrchestrator] LLM call completed in ${duration}ms. Response length: ${fullText.length} chars. Has text: ${hasText}`);
					
					if (fullText.length === 0 && !hasText) {
						this.logService.warn(`[AgentOrchestrator] Empty response received! Message count: ${params.messages.length}`);
					}
					
					resolve(fullText);
				},
				onError: (error) => {
					clearTimeout(timeoutId);
					this.logService.error(`[AgentOrchestrator] LLM call error: ${error.message}`);
					reject(new Error(error.message));
				},
				onAbort: () => {
					clearTimeout(timeoutId);
					this.logService.warn(`[AgentOrchestrator] LLM call aborted`);
					reject(new Error('LLM call aborted'));
				},
			});

			if (!requestId) {
				clearTimeout(timeoutId);
				reject(new Error('Failed to send LLM message'));
			}
		});
	}

	async executeTool(_toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
		const toolId = generateUuid();
		this.logService.info(`[AgentOrchestrator] Executing tool: ${_toolName} with params: ${JSON.stringify(params)}`);

		return {
			toolName: _toolName,
			toolId,
			message: `Tool ${_toolName} called with params: ${JSON.stringify(params)}`,
			status: 'executed',
		};
	}

	getContext(threadId: string): AgentContext | undefined {
		return this._contexts.get(threadId);
	}

	cancelPlan(threadId: string): void {
		const plan = this._activePlans.get(threadId);
		if (plan) {
			plan.status = 'cancelled';
			for (const task of plan.tasks) {
				if (task.status === 'in_progress' || task.status === 'pending') {
					task.status = 'cancelled';
				}
			}
		}
		this._activePlans.delete(threadId);

		this.addAgentMessage(threadId, {
			from: 'orchestrator' as AgentRole,
			to: 'all' as AgentRole,
			content: '🛑 **Plano Cancelado**\n\nA execução foi cancelada pelo usuário.',
			taskId: undefined,
		});
	}

	createPlanFromChecklist(checklist: AgentTask[], threadId: string, originalRequest: string): AgentPlan {
		const planId = generateUuid();
		const plan: AgentPlan = {
			id: planId,
			originalRequest,
			tasks: checklist.map(task => ({
				...task,
				model: task.userAssignedAgent || task.model,
			})),
			createdAt: Date.now(),
			status: 'ready',
		};

		const context = this._contexts.get(threadId);
		if (context) {
			context.currentPlan = plan;
		}
		this._activePlans.set(threadId, plan);
		return plan;
	}

	updateTaskAssignment(threadId: string, taskId: string, agentModel: string): void {
		const plan = this._activePlans.get(threadId);
		if (plan) {
			const task = plan.tasks.find(t => t.id === taskId);
			if (task) {
				task.userAssignedAgent = agentModel;
				task.model = agentModel;
				task.userEdited = true;
			}
		}
	}

	async executeSelectedTasks(threadId: string, taskIds: string[]): Promise<void> {
		const plan = this._activePlans.get(threadId);
		if (!plan) {
			throw new Error(`No plan found for thread ${threadId}`);
		}

		const context = this._contexts.get(threadId);
		if (!context) {
			throw new Error(`No context found for thread ${threadId}`);
		}

		const settings = this.voidSettingsService.state.globalSettings.multiAgentSettings;
		const tasksToExecute = plan.tasks.filter(t => taskIds.includes(t.id) && t.status === 'pending');

		if (settings.enableParallelExecution) {
			await Promise.all(tasksToExecute.map(task => this._executeTask(task, context, settings, threadId)));
		} else {
			for (const task of tasksToExecute) {
				await this._executeTask(task, context, settings, threadId);
			}
		}
	}

	refinePlan(threadId: string, userEdits: Partial<AgentTask>[]): void {
		const plan = this._activePlans.get(threadId);
		if (!plan) {
			return;
		}

		for (const edit of userEdits) {
			const task = plan.tasks.find(t => t.id === edit.id);
			if (task) {
				Object.assign(task, edit, { userEdited: true });
			}
		}
	}

	addAgentMessage(threadId: string, message: Omit<AgentMessage, 'timestamp'>): void {
		const context = this._contexts.get(threadId);
		if (context) {
			context.sharedHistory.push({
				...message,
				timestamp: Date.now(),
			});
		}
	}

	override dispose(): void {
		this._contexts.clear();
		this._activePlans.clear();
		this._toolResults.clear();
		super.dispose();
	}
}

registerSingleton(IAgentOrchestratorService, AgentOrchestratorService, InstantiationType.Delayed);