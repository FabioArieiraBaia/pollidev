/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { Check, X, Edit2, Trash2, Play, PlayCircle, Save, XCircle } from 'lucide-react';
import { AgentTask, AgentPlan } from '../../../../common/multiAgentTypes.js';
import { useAccessor, useSettingsState } from '../util/services.js';
import { IAgentOrchestratorService } from '../../../../common/agentOrchestratorService.js';
import { VoidCustomDropdownBox, VoidSimpleInputBox } from '../util/inputs.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';

interface AgentChecklistProps {
	plan: AgentPlan | null;
	threadId: string;
	onPlanUpdate?: (plan: AgentPlan) => void;
	onExecute?: (taskIds: string[]) => void;
	onExecuteAll?: () => void;
}

export const AgentChecklist: React.FC<AgentChecklistProps> = ({
	plan,
	threadId,
	onPlanUpdate,
	onExecute,
	onExecuteAll,
}) => {
	const accessor = useAccessor();
	const settingsState = useSettingsState();
	const orchestratorService = accessor.get('IAgentOrchestratorService') as IAgentOrchestratorService;
	
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const [editDescription, setEditDescription] = useState<string>('');
	const [localPlan, setLocalPlan] = useState<AgentPlan | null>(plan);

	useEffect(() => {
		setLocalPlan(plan);
	}, [plan]);

	if (!localPlan || localPlan.tasks.length === 0) {
		return null;
	}

	const availableModels = settingsState._modelOptions
		.filter(o => o.selection.providerName === 'pollinations')
		.map(o => o.selection.modelName);

	const handleTaskSelect = (taskId: string, selected: boolean) => {
		if (!localPlan) return;
		const updatedTasks = localPlan.tasks.map(t =>
			t.id === taskId ? { ...t, selected } : t
		);
		const updatedPlan = { ...localPlan, tasks: updatedTasks };
		setLocalPlan(updatedPlan);
		onPlanUpdate?.(updatedPlan);
	};

	const handleTaskEdit = (task: AgentTask) => {
		setEditingTaskId(task.id);
		setEditDescription(task.description);
	};

	const handleTaskSave = (taskId: string) => {
		if (!localPlan) return;
		const updatedTasks = localPlan.tasks.map(t =>
			t.id === taskId
				? { ...t, description: editDescription, userEdited: true }
				: t
		);
		const updatedPlan = { ...localPlan, tasks: updatedTasks };
		setLocalPlan(updatedPlan);
		setEditingTaskId(null);
		onPlanUpdate?.(updatedPlan);
	};

	const handleTaskDelete = (taskId: string) => {
		if (!localPlan) return;
		const updatedTasks = localPlan.tasks.filter(t => t.id !== taskId);
		const updatedPlan = { ...localPlan, tasks: updatedTasks };
		setLocalPlan(updatedPlan);
		onPlanUpdate?.(updatedPlan);
	};

	const handleAgentAssignment = (taskId: string, model: string) => {
		if (!localPlan) return;
		const updatedTasks = localPlan.tasks.map(t =>
			t.id === taskId
				? { ...t, userAssignedAgent: model, model, userEdited: true }
				: t
		);
		const updatedPlan = { ...localPlan, tasks: updatedTasks };
		setLocalPlan(updatedPlan);
		onPlanUpdate?.(updatedPlan);
	};

	const handleExecuteSelected = () => {
		if (!localPlan) return;
		const selectedTaskIds = localPlan.tasks
			.filter(t => t.selected && t.status === 'pending')
			.map(t => t.id);
		if (selectedTaskIds.length > 0) {
			onExecute?.(selectedTaskIds);
		}
	};

	const selectedCount = localPlan.tasks.filter(t => t.selected).length;
	const pendingCount = localPlan.tasks.filter(t => t.status === 'pending').length;

	return (
		<ErrorBoundary>
			<div className="agent-checklist border-t border-[var(--void-border-4)] bg-[var(--void-bg-2)]">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-2 border-b border-[var(--void-border-4)] bg-[var(--void-bg-1)]">
					<div className="flex items-center gap-2">
						<Check className="h-4 w-4 text-[var(--void-fg-1)]" />
						<span className="text-sm font-semibold text-[var(--void-fg-1)]">
							Task Checklist ({localPlan.tasks.length} tasks)
						</span>
					</div>
					<div className="flex items-center gap-2">
						{selectedCount > 0 && (
							<button
								onClick={handleExecuteSelected}
								className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1"
							>
								<Play className="h-3 w-3" />
								Execute Selected ({selectedCount})
							</button>
						)}
						{pendingCount > 0 && (
							<button
								onClick={onExecuteAll}
								className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors flex items-center gap-1"
							>
								<PlayCircle className="h-3 w-3" />
								Execute All
							</button>
						)}
					</div>
				</div>

				{/* Tasks List */}
				<div className="max-h-96 overflow-y-auto">
					{localPlan.tasks.map((task, index) => (
						<div
							key={task.id}
							className={`px-4 py-3 border-b border-[var(--void-border-4)] hover:bg-[var(--void-bg-1)] transition-colors ${
								task.status === 'completed' ? 'opacity-60' : ''
							}`}
						>
							<div className="flex items-start gap-3">
								{/* Checkbox */}
								<input
									type="checkbox"
									checked={task.selected || false}
									onChange={(e) => handleTaskSelect(task.id, e.target.checked)}
									disabled={task.status !== 'pending'}
									className="mt-1"
								/>

								{/* Task Number */}
								<span className="text-xs text-[var(--void-fg-3)] mt-1 min-w-[24px]">
									{index + 1}.
								</span>

								{/* Task Content */}
								<div className="flex-1 min-w-0">
									{editingTaskId === task.id ? (
										<div className="flex items-center gap-2">
											<VoidSimpleInputBox
												value={editDescription}
												onChange={setEditDescription}
												className="flex-1 text-sm"
											/>
											<button
												onClick={() => handleTaskSave(task.id)}
												className="p-1 hover:bg-[var(--void-bg-2-hover)] rounded"
												title="Save"
											>
												<Save className="h-4 w-4 text-green-500" />
											</button>
											<button
												onClick={() => setEditingTaskId(null)}
												className="p-1 hover:bg-[var(--void-bg-2-hover)] rounded"
												title="Cancel"
											>
												<XCircle className="h-4 w-4 text-red-500" />
											</button>
										</div>
									) : (
										<div className="flex items-start gap-2">
											<span className={`text-sm flex-1 ${
												task.status === 'completed' ? 'line-through text-[var(--void-fg-3)]' : 'text-[var(--void-fg-1)]'
											}`}>
												{task.description}
											</span>
											{task.status === 'pending' && (
												<div className="flex items-center gap-1">
													<button
														onClick={() => handleTaskEdit(task)}
														className="p-1 hover:bg-[var(--void-bg-2-hover)] rounded"
														title="Edit"
													>
														<Edit2 className="h-3 w-3 text-[var(--void-fg-2)]" />
													</button>
													<button
														onClick={() => handleTaskDelete(task.id)}
														className="p-1 hover:bg-[var(--void-bg-2-hover)] rounded"
														title="Delete"
													>
														<Trash2 className="h-3 w-3 text-red-500" />
													</button>
												</div>
											)}
										</div>
									)}

									{/* Agent Assignment */}
									<div className="mt-2 flex items-center gap-2">
										<span className="text-xs text-[var(--void-fg-3)]">Agent:</span>
										<VoidCustomDropdownBox
											options={availableModels}
											selectedOption={task.userAssignedAgent || task.model || availableModels[0] || ''}
											onChangeOption={(model) => handleAgentAssignment(task.id, model)}
											getOptionDisplayName={(val) => val}
											getOptionDropdownName={(val) => val}
											getOptionDropdownDetail={(val) => 'pollinations'}
											getOptionsEqual={(a, b) => a === b}
											className="text-xs bg-[var(--void-bg-1)] border border-[var(--void-border-4)] rounded px-2 py-1"
										/>
									</div>

									{/* Status Badge */}
									<div className="mt-2 flex items-center gap-2">
										<span className={`text-xs px-2 py-0.5 rounded ${
											task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
											task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
											task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
											'bg-gray-500/20 text-gray-400'
										}`}>
											{task.status}
										</span>
										{task.userEdited && (
											<span className="text-xs text-[var(--void-fg-3)]">(edited)</span>
										)}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</ErrorBoundary>
	);
};

