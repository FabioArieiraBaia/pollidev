/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Bot, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AgentTask } from '../../../../common/multiAgentTypes.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';

interface ActiveAgent {
	id: string;
	model: string;
	currentTask: AgentTask | null;
	status: 'running' | 'completed' | 'error';
	progress: string;
	logs: string[];
	result?: any;
}

interface ActiveAgentsViewProps {
	activeAgents: ActiveAgent[];
}

export const ActiveAgentsView: React.FC<ActiveAgentsViewProps> = ({ activeAgents }) => {
	const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

	if (activeAgents.length === 0) {
		return null;
	}

	const toggleExpand = (agentId: string) => {
		const newExpanded = new Set(expandedAgents);
		if (newExpanded.has(agentId)) {
			newExpanded.delete(agentId);
		} else {
			newExpanded.add(agentId);
		}
		setExpandedAgents(newExpanded);
	};

	const getStatusIcon = (status: ActiveAgent['status']) => {
		switch (status) {
			case 'running':
				return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
			case 'completed':
				return <CheckCircle className="h-4 w-4 text-green-400" />;
			case 'error':
				return <XCircle className="h-4 w-4 text-red-400" />;
		}
	};

	return (
		<ErrorBoundary>
			<div className="active-agents-view border-t border-[var(--void-border-4)] bg-[var(--void-bg-2)]">
				{/* Header */}
				<div className="px-4 py-2 border-b border-[var(--void-border-4)] bg-[var(--void-bg-1)]">
					<div className="flex items-center gap-2">
						<Bot className="h-4 w-4 text-[var(--void-fg-1)]" />
						<span className="text-sm font-semibold text-[var(--void-fg-1)]">
							Active Agents ({activeAgents.length})
						</span>
					</div>
				</div>

				{/* Agents List */}
				<div className="max-h-96 overflow-y-auto">
					{activeAgents.map((agent) => {
						const isExpanded = expandedAgents.has(agent.id);
						return (
							<div
								key={agent.id}
								className="border-b border-[var(--void-border-4)] bg-[var(--void-bg-2)]"
							>
								{/* Agent Header */}
								<button
									onClick={() => toggleExpand(agent.id)}
									className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--void-bg-1)] transition-colors"
								>
									<div className="flex items-center gap-3 flex-1 min-w-0">
										{getStatusIcon(agent.status)}
										<div className="flex-1 min-w-0 text-left">
											<div className="text-sm font-medium text-[var(--void-fg-1)] truncate">
												{agent.model}
											</div>
											{agent.currentTask && (
												<div className="text-xs text-[var(--void-fg-3)] truncate mt-1">
													{agent.currentTask.description}
												</div>
											)}
										</div>
									</div>
									{isExpanded ? (
										<ChevronUp className="h-4 w-4 text-[var(--void-fg-2)] flex-shrink-0" />
									) : (
										<ChevronDown className="h-4 w-4 text-[var(--void-fg-2)] flex-shrink-0" />
									)}
								</button>

								{/* Agent Details */}
								{isExpanded && (
									<div className="px-4 pb-3 space-y-2">
										{/* Progress */}
										{agent.progress && (
											<div className="text-xs text-[var(--void-fg-2)]">
												{agent.progress}
											</div>
										)}

										{/* Logs */}
										{agent.logs.length > 0 && (
											<div className="bg-[var(--void-bg-1)] rounded p-2 max-h-32 overflow-y-auto">
												<div className="text-xs font-medium text-[var(--void-fg-2)] mb-1">Logs:</div>
												{agent.logs.map((log, i) => (
													<div key={i} className="text-xs text-[var(--void-fg-3)] font-mono">
														{log}
													</div>
												))}
											</div>
										)}

										{/* Result */}
										{agent.status === 'completed' && agent.result && (
											<div className="bg-green-500/10 border border-green-500/20 rounded p-2">
												<div className="text-xs font-medium text-green-400 mb-1">Result:</div>
												<div className="text-xs text-[var(--void-fg-2)]">
													{typeof agent.result === 'string' ? agent.result : JSON.stringify(agent.result, null, 2)}
												</div>
											</div>
										)}

										{/* Error */}
										{agent.status === 'error' && (
											<div className="bg-red-500/10 border border-red-500/20 rounded p-2">
												<div className="text-xs font-medium text-red-400 mb-1">Error:</div>
												<div className="text-xs text-[var(--void-fg-2)]">
													{agent.result || 'Unknown error'}
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</ErrorBoundary>
	);
};

