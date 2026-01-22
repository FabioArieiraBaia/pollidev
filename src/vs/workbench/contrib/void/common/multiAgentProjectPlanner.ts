/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { AgentPlan } from './multiAgentTypes.js';

export const IMultiAgentProjectPlanner = createDecorator<IMultiAgentProjectPlanner>('MultiAgentProjectPlanner');

export interface IMultiAgentProjectPlanner {
	readonly _serviceBrand: undefined;
	generateDashboardMarkdown(plan: AgentPlan, stack?: string): string;
	updateTaskStatusInMarkdown(content: string, taskId: string, status: string): string;
}

export class MultiAgentProjectPlanner extends Disposable implements IMultiAgentProjectPlanner {
	declare readonly _serviceBrand: undefined;

	constructor() {
		super();
	}

	generateDashboardMarkdown(plan: AgentPlan, stack: string = 'Not defined'): string {
		const date = new Date().toLocaleString();
		
		let tasksSection = '';
		plan.tasks.forEach((task, index) => {
			const statusIcon = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳';
			const colorClass = task.status === 'completed' ? 'green-neon' : task.status === 'in_progress' ? 'blue-neon' : 'yellow-neon';
			
			tasksSection += `
### [${index + 1}] ${task.description}
- **ID**: \`${task.id}\`
- **Status**: ${statusIcon} <span class="${colorClass}">${task.status.toUpperCase()}</span>
- **Agent**: <span class="purple-neon">${task.userAssignedAgent || task.model || 'Auto'}</span>
`;
		});

		return `
# 🚀 PROJETO MULTI-AGENTE: DASHBOARD DINÂMICO

> **Status do Sistema**: <span class="green-neon">ONLINE</span> | **Data**: ${date}
> **Thread ID**: \`${plan.id}\`

---

## 🛠️ TECH STACK
<div class="stack-box blue-neon-border">
${stack}
</div>

---

## 📋 PLANO DE EXECUÇÃO
${tasksSection}

---

## 🤖 STATUS DOS AGENTES
- **Orchestrator**: <span class="green-neon">LISTENING</span>
- **Planner**: <span class="blue-neon">IDLE</span>
- **Executors**: <span class="yellow-neon">ACTIVE (3)</span>

---

<style>
.green-neon { color: #39ff14; text-shadow: 0 0 5px #39ff14; font-weight: bold; }
.blue-neon { color: #00f3ff; text-shadow: 0 0 5px #00f3ff; font-weight: bold; }
.yellow-neon { color: #fff01f; text-shadow: 0 0 5px #fff01f; font-weight: bold; }
.red-neon { color: #ff3131; text-shadow: 0 0 5px #ff3131; font-weight: bold; }
.purple-neon { color: #bc13fe; text-shadow: 0 0 5px #bc13fe; font-weight: bold; }

.blue-neon-border {
    border: 2px solid #00f3ff;
    padding: 15px;
    border-radius: 10px;
    box-shadow: 0 0 10px #00f3ff;
    background: rgba(0, 243, 255, 0.05);
}

.stack-box {
    font-family: 'Courier New', Courier, monospace;
    font-size: 1.1em;
}
</style>

---
*Gerado automaticamente pelo PolliDev Multi-Agent System*
`;
	}

	updateTaskStatusInMarkdown(content: string, taskId: string, status: string): string {
		const statusIcon = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';
		const colorClass = status === 'completed' ? 'green-neon' : status === 'in_progress' ? 'blue-neon' : 'yellow-neon';
		
		const regex = new RegExp(`- \\*\\*ID\\*\\*: \`${taskId}\`\\n- \\*\\*Status\\*\\*: .* <span class=".*">.*<\\/span>`, 'g');
		const replacement = `- **ID**: \`${taskId}\`\n- **Status**: ${statusIcon} <span class="${colorClass}">${status.toUpperCase()}</span>`;
		
		return content.replace(regex, replacement);
	}
}

registerSingleton(IMultiAgentProjectPlanner, MultiAgentProjectPlanner, InstantiationType.Delayed);