/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Tipos e interfaces para o sistema de multiagentes
 */

export type AgentRole = 'orchestrator' | 'planner' | 'executor' | 'reviewer'

export type AgentTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface AgentTask {
	id: string
	description: string
	assignedTo: AgentRole
	model?: string // Modelo específico para esta tarefa
	status: AgentTaskStatus
	result?: any
	error?: string
	dependencies?: string[] // IDs de tarefas que devem ser completadas antes
	createdAt: number
	startedAt?: number
	completedAt?: number
	userEdited?: boolean // Rastrear se o usuário editou esta tarefa
	userAssignedAgent?: string // Delegação manual do usuário (nome do modelo)
	selected?: boolean // Para checklist interativa
}

export interface AgentPlan {
	id: string
	originalRequest: string
	tasks: AgentTask[]
	createdAt: number
	status: 'planning' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled'
}

export interface MultiAgentSettings {
	enabled: boolean
	orchestratorModel: string // Modelo para orquestração (ex: 'gemini-large')
	plannerModel: string // Modelo para planejamento (ex: 'perplexity-reasoning')
	executorModels: string[] // Modelos para execução (ex: ['qwen-coder', 'gemini-fast'])
	enableParallelExecution: boolean
	maxConcurrentAgents: number
	autoApproveTasks: boolean // Aprovar tarefas automaticamente
	maxRetries: number // Número máximo de tentativas por tarefa
}

export const defaultMultiAgentSettings: MultiAgentSettings = {
	enabled: false,
	orchestratorModel: 'gemini-large',
	plannerModel: 'perplexity-reasoning',
	executorModels: ['qwen-coder', 'gemini-fast', 'openai-fast'],
	enableParallelExecution: true,
	maxConcurrentAgents: 3,
	autoApproveTasks: false,
	maxRetries: 2,
}

export interface AgentMessage {
	from: AgentRole
	to: AgentRole | 'all'
	content: string
	taskId?: string
	timestamp: number
}

export interface AgentContext {
	currentPlan?: AgentPlan
	sharedHistory: AgentMessage[]
	workspaceState: {
		filesModified: string[]
		commandsExecuted: string[]
		errors: string[]
	}
}

