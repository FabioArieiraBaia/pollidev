/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { AgentPlan, AgentTask, AgentContext, AgentMessage, MultiAgentSettings } from './multiAgentTypes.js';
import { ChatMode } from './voidSettingsTypes.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IAgentOrchestratorService = createDecorator<IAgentOrchestratorService>('AgentOrchestratorService');

export interface IAgentOrchestratorService {
	readonly _serviceBrand: undefined;

	/**
	 * Processa uma requisição usando o sistema de multiagentes
	 */
	processRequest(request: string, threadId: string, chatMode: ChatMode): Promise<void>;

	/**
	 * Obtém o contexto atual dos agentes
	 */
	getContext(threadId: string): AgentContext | undefined;

	/**
	 * Cancela a execução de um plano
	 */
	cancelPlan(threadId: string): void;

	/**
	 * Cria um plano a partir de uma checklist editada pelo usuário
	 */
	createPlanFromChecklist(checklist: AgentTask[], threadId: string, originalRequest: string): AgentPlan;

	/**
	 * Atualiza a delegação de uma tarefa
	 */
	updateTaskAssignment(threadId: string, taskId: string, agentModel: string): void;

	/**
	 * Executa apenas tarefas selecionadas
	 */
	executeSelectedTasks(threadId: string, taskIds: string[]): Promise<void>;

	/**
	 * Refina um plano com edições do usuário
	 */
	refinePlan(threadId: string, userEdits: Partial<AgentTask>[]): void;
}

export class AgentOrchestratorService extends Disposable implements IAgentOrchestratorService {
	declare readonly _serviceBrand: undefined;

	private readonly _contexts = new Map<string, AgentContext>();
	private readonly _activePlans = new Map<string, AgentPlan>();

	constructor(
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
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

		// Inicializar contexto se não existir
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

		// Fase 1: Orquestrador analisa a requisição
		const needsPlanning = await this._orchestratorAnalyze(request, context, settings);

		if (needsPlanning) {
			// Fase 2: Planejador cria o plano
			const plan = await this._plannerCreatePlan(request, context, settings);
			context.currentPlan = plan;
			this._activePlans.set(threadId, plan);

			// Fase 3: Executar tarefas
			await this._executePlan(plan, context, settings, threadId);
		} else {
			// Execução direta sem planejamento
			await this._executeDirect(request, context, settings, threadId);
		}
	}

	private async _orchestratorAnalyze(
		request: string,
		context: AgentContext,
		settings: MultiAgentSettings
	): Promise<boolean> {
		// TODO: Implementar análise do orquestrador
		// Por enquanto, sempre retorna true para usar planejamento
		return true;
	}

	private async _plannerCreatePlan(
		request: string,
		context: AgentContext,
		settings: MultiAgentSettings
	): Promise<AgentPlan> {
		const planId = generateUuid();
		const tasks: AgentTask[] = [];

		// TODO: Implementar criação de plano pelo planejador
		// Por enquanto, cria um plano básico
		const task: AgentTask = {
			id: generateUuid(),
			description: request,
			assignedTo: 'executor',
			status: 'pending',
			createdAt: Date.now(),
		};

		tasks.push(task);

		return {
			id: planId,
			originalRequest: request,
			tasks,
			createdAt: Date.now(),
			status: 'ready',
		};
	}

	private async _executePlan(
		plan: AgentPlan,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		plan.status = 'executing';

		if (settings.enableParallelExecution) {
			await this._executeParallel(plan, context, settings, threadId);
		} else {
			await this._executeSequential(plan, context, settings, threadId);
		}

		plan.status = 'completed';
	}

	private async _executeSequential(
		plan: AgentPlan,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		for (const task of plan.tasks) {
			if (task.status === 'pending') {
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
		const pendingTasks = plan.tasks.filter(t => t.status === 'pending');
		const concurrentTasks: Promise<void>[] = [];

		for (let i = 0; i < Math.min(settings.maxConcurrentAgents, pendingTasks.length); i++) {
			const task = pendingTasks[i];
			concurrentTasks.push(this._executeTask(task, context, settings, threadId));
		}

		await Promise.all(concurrentTasks);
	}

	private async _executeTask(
		task: AgentTask,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		task.status = 'in_progress';
		task.startedAt = Date.now();

		try {
			// Selecionar modelo executor para a tarefa
			const executorModel = task.model || this._selectExecutorModel(settings);
			
			// Armazenar o modelo usado na tarefa para referência
			task.model = executorModel;

			// TODO: Implementar execução real usando llmMessageService
			// Por enquanto, apenas marca como completo
			task.status = 'completed';
			task.completedAt = Date.now();

			// Adicionar mensagem ao contexto
			const message: AgentMessage = {
				from: 'executor',
				to: 'orchestrator',
				content: `Tarefa ${task.id} completada: ${task.description}`,
				taskId: task.id,
				timestamp: Date.now(),
			};
			context.sharedHistory.push(message);
		} catch (error) {
			task.status = 'failed';
			task.error = error instanceof Error ? error.message : String(error);
			context.workspaceState.errors.push(task.error);
		}
	}

	private async _executeDirect(
		request: string,
		context: AgentContext,
		settings: MultiAgentSettings,
		threadId: string
	): Promise<void> {
		// Execução direta sem planejamento
		// TODO: Implementar
	}

	private _selectExecutorModel(settings: MultiAgentSettings): string {
		// Seleciona um modelo executor aleatoriamente da lista
		// Será usado na implementação completa da execução de tarefas
		const models = settings.executorModels;
		if (models.length === 0) {
			return 'gemini-fast'; // fallback
		}
		return models[Math.floor(Math.random() * models.length)];
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

	override dispose(): void {
		this._contexts.clear();
		this._activePlans.clear();
		super.dispose();
	}
}

registerSingleton(IAgentOrchestratorService, AgentOrchestratorService, InstantiationType.Delayed);

