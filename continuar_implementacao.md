# 🚀 Guia de Implementação: Sistema Multi-Agente (Pollidev)

> **Última atualização:** 21/01/2026  
> **Status:** Toggle manual ativado e funcional, mas execução de ferramentas não ocorre.

---

## 📊 1. Estado Atual da Implementação (Verificado)

### ✅ O que JÁ EXISTE e FUNCIONA:

| Componente | Arquivo | Status |
|------------|---------|--------|
| Serviço Orquestrador | `common/agentOrchestratorService.ts` | ✅ Existe, classe implementada |
| Tipos Multi-Agent | `common/multiAgentTypes.ts` | ✅ Tipos definidos (AgentRole, AgentTask, etc.) |
| Componentes React | `react/src/multi-agent-tsx/` | ✅ AgentChecklist, ActiveAgentsView |
| Integração SidebarChat | `react/src/sidebar-tsx/SidebarChat.tsx` | ✅ Importa componentes multi-agent |
| Função Orquestradora | `browser/chatThreadService.ts` linha 618 | ✅ `_runMultiAgentOrchestrator` existe |
| Settings Multi-Agent | `common/voidSettingsTypes.ts` | ✅ `multiAgentSettings` definido |
| Verificação de Modo | `browser/convertToLLMMessageService.ts` linha 758 | ✅ Checa `chatMode === 'multi-agent'` |

### ❌ O PROBLEMA IDENTIFICADO:

**Localização:** `src/vs/workbench/contrib/void/common/agentOrchestratorService.ts`

**Método:** `_parseToolCallFromResponse()` (linha 546)

**O que acontece:**
1. O sistema envia a mensagem para a LLM
2. A LLM responde em **texto natural** (ex: "I'll use create_file to create your component")
3. O parser tenta detectar tool calls em 3 formatos estruturados:
   - **XML:** `<tool_call>nome</tool_call><tool_params>{...}</tool_params>`
   - **JSON:** `{"tool": "nome", params: {...}}`
   - **Simple:** `TOOL_CALL: name=nome, params={...}`
4. **NENHUM formato bate** → Cai no fallback (linha 587)
5. O código apenas **LOGA** a menção da ferramenta mas **NÃO EXECUTA**

**Log do erro (linha 591):**
```
[AgentOrchestrator] LLM mentions tool "create_file" but not in structured format
```

---

## 🔍 2. Investigação Pendente

Antes de implementar correções, precisamos verificar:

### 2.1 AgentToolsService
```
Verificar se existe: src/vs/workbench/contrib/void/browser/agentToolsServiceImpl.ts
Verificar registro: void.contribution.ts deve importar este arquivo
```

### 2.2 System Prompt
```
Localização provável: common/prompt/prompts.ts ou agentOrchestratorService.ts
Verificar: O prompt instrui a LLM a usar formato estruturado?
```

### 2.3 Loop de Execução
```
Arquivo: agentOrchestratorService.ts
Verificar: Existe while loop para re-tentar após executar ferramenta?
Linhas relevantes: _runAgentTask(), próximo de linha 519
```

### 2.4 Ferramentas Disponíveis
```
Verificar quais ferramentas estão definidas:
- create_file
- edit_file
- read_file
- run_command
- browser_navigate
```

---

## 🛠️ 3. Plano de Correção (Ordem de Execução)

### 🔴 CRÍTICO - Passo 1: Corrigir o System Prompt

**Por quê:** Se a LLM não sabe o formato esperado, ela nunca vai usar.

**Arquivo:** `src/vs/workbench/contrib/void/common/agentOrchestratorService.ts`

**Ação:** Adicionar instruções explícitas no prompt do sistema:

```typescript
const AGENT_SYSTEM_PROMPT = `
Você é um agente autônomo capaz de executar tarefas.

IMPORTANTE: Quando precisar usar uma ferramenta, SEMPRE use este formato XML:

<tool_call>nome_da_ferramenta</tool_call>
<tool_params>{"param1": "valor1", "param2": "valor2"}</tool_params>

Ferramentas disponíveis:
- create_file: Cria um arquivo. Params: {path: string, content: string}
- edit_file: Edita um arquivo. Params: {path: string, search: string, replace: string}
- read_file: Lê um arquivo. Params: {path: string}
- run_command: Executa comando no terminal. Params: {command: string, cwd?: string}

NUNCA descreva o que vai fazer em texto. SEMPRE use o formato XML acima.
`;
```

### 🟠 IMPORTANTE - Passo 2: Melhorar o Parser (Fallback Inteligente)

**Por quê:** Mesmo com prompt bom, LLMs às vezes escapam do formato.

**Arquivo:** `src/vs/workbench/contrib/void/common/agentOrchestratorService.ts`

**Ação:** Na função `_parseToolCallFromResponse`, após linha 591, adicionar inferência:

```typescript
// ATUAL: Apenas loga
this.logService.info(`[AgentOrchestrator] LLM mentions tool "${descriptionMatch[1]}" but not in structured format`);

// ADICIONAR: Tentar inferir a chamada
const inferredTool = this._inferToolCallFromNaturalLanguage(response, descriptionMatch[1]);
if (inferredTool) {
    return inferredTool;
}
```

**Nova função a criar:**
```typescript
private _inferToolCallFromNaturalLanguage(response: string, toolName: string): ToolCall | null {
    // Mapear palavras-chave para parâmetros
    const toolInference: Record<string, (text: string) => object | null> = {
        'create_file': (text) => {
            const pathMatch = text.match(/(?:file|arquivo|path)[:\s]+[`"']?([^`"'\n]+)[`"']?/i);
            return pathMatch ? { path: pathMatch[1], content: '' } : null;
        },
        'run_command': (text) => {
            const cmdMatch = text.match(/(?:command|comando|run|execute)[:\s]+[`"']?([^`"'\n]+)[`"']?/i);
            return cmdMatch ? { command: cmdMatch[1] } : null;
        },
        // ... outros tools
    };
    
    const inferFn = toolInference[toolName];
    if (inferFn) {
        const params = inferFn(response);
        if (params) {
            this.logService.info(`[AgentOrchestrator] Inferred tool call: ${toolName}`);
            return { name: toolName, params };
        }
    }
    return null;
}
```

### 🟡 NECESSÁRIO - Passo 3: Verificar/Criar AgentToolsService

**Por quê:** Este serviço executa as ações reais (criar arquivos, rodar comandos).

**Verificar existência:**
```bash
# Procurar o arquivo
dir /s /b src\vs\workbench\contrib\void\*agentTools*
```

**Se não existir, criar:**

**Arquivo:** `src/vs/workbench/contrib/void/browser/agentToolsServiceImpl.ts`

```typescript
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAgentToolsService } from '../common/agentToolsService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
// ... outros imports

export class AgentToolsService implements IAgentToolsService {
    constructor(
        @IFileService private readonly fileService: IFileService,
        // ... outras dependências
    ) {}

    async createFile(path: string, content: string): Promise<ToolResult> {
        // Implementação real
    }

    async editFile(path: string, search: string, replace: string): Promise<ToolResult> {
        // Implementação real
    }

    // ... outros métodos
}

registerSingleton(IAgentToolsService, AgentToolsService, InstantiationType.Delayed);
```

**Registrar em:** `src/vs/workbench/contrib/void/browser/void.contribution.ts`
```typescript
import './agentToolsServiceImpl.js'; // Adicionar esta linha
```

### 🟢 MELHORIA - Passo 4: Implementar Loop de Re-tentativa

**Por quê:** O agente precisa continuar após executar uma ferramenta.

**Arquivo:** `src/vs/workbench/contrib/void/common/agentOrchestratorService.ts`

**Verificar/Implementar:** Método `_runAgentTask` deve ter estrutura:

```typescript
private async _runAgentTask(task: AgentTask): Promise<AgentResult> {
    const MAX_ITERATIONS = 10;
    let iteration = 0;
    const conversationHistory: Message[] = [];

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        
        // 1. Chamar LLM
        const response = await this._callLLM(conversationHistory);
        
        // 2. Tentar parsear tool call
        const toolCall = this._parseToolCallFromResponse(response);
        
        if (toolCall) {
            // 3. Executar ferramenta
            const result = await this._executeToolCall(toolCall);
            
            // 4. Adicionar resultado ao histórico
            conversationHistory.push({
                role: 'tool',
                content: `Tool ${toolCall.name} result: ${JSON.stringify(result)}`
            });
            
            // Continua o loop para próxima iteração
        } else {
            // 5. Sem tool call = resposta final
            return this._parseTaskResult(response);
        }
    }
    
    throw new Error('Max iterations reached');
}
```

---

## 📁 4. Arquivos-Chave para Editar

```
src/vs/workbench/contrib/void/
├── common/
│   ├── agentOrchestratorService.ts    ← PRINCIPAL (parser + loop)
│   ├── agentToolsService.ts           ← Interface (verificar se existe)
│   └── multiAgentTypes.ts             ← ✅ OK
├── browser/
│   ├── agentToolsServiceImpl.ts       ← Implementação (criar se não existir)
│   ├── void.contribution.ts           ← Registro de serviços
│   └── chatThreadService.ts           ← Integração com chat
└── react/src/
    └── multi-agent-tsx/               ← ✅ OK (UI funciona)
```

---

## 💻 5. Comandos para Investigação

```powershell
# Ver estrutura completa da pasta void
Get-ChildItem -Path "src\vs\workbench\contrib\void" -Recurse -Name | Select-String "agent"

# Procurar por AgentToolsService
Select-String -Path "src\vs\workbench\contrib\void\**\*.ts" -Pattern "AgentToolsService" -Recurse

# Procurar registros de singleton
Select-String -Path "src\vs\workbench\contrib\void\**\*.ts" -Pattern "registerSingleton" -Recurse

# Ver o system prompt atual
Select-String -Path "src\vs\workbench\contrib\void\**\*.ts" -Pattern "system.*prompt|SYSTEM_PROMPT" -Recurse

# Compilar após mudanças
npm run compile

# Rodar para testar
.\scripts\code.bat
```

---

## 🎯 6. Critérios de Sucesso

O sistema estará funcionando quando:

1. ✅ Usuário digita: "Crie um arquivo hello.txt com 'Hello World'"
2. ✅ LLM responde com formato XML: `<tool_call>create_file</tool_call>...`
3. ✅ Parser detecta a tool call corretamente
4. ✅ AgentToolsService executa e cria o arquivo
5. ✅ Resultado volta para LLM
6. ✅ LLM confirma: "Arquivo criado com sucesso!"
7. ✅ UI mostra checklist de ações executadas

---

## ⚠️ 7. Riscos e Cuidados

1. **Dependência Circular:** Nunca importar de `browser/` em `common/`
2. **Registro de Serviço:** O `registerSingleton` DEVE estar no arquivo que é importado por `void.contribution.ts`
3. **Permissões de Arquivo:** O AgentToolsService precisa de acesso ao IFileService
4. **Rate Limiting:** Implementar delay entre iterações do loop para não sobrecarregar a LLM
5. **Segurança:** Validar paths de arquivo para evitar escrita fora do workspace

---

## 📝 8. Próximos Passos Imediatos

1. [ ] Verificar se `agentToolsService.ts` (interface) existe em `common/`
2. [ ] Verificar se `agentToolsServiceImpl.ts` existe em `browser/`
3. [ ] Localizar o system prompt atual no `agentOrchestratorService.ts`
4. [ ] Verificar a estrutura do método `_runAgentTask`
5. [ ] Testar com logs detalhados para ver onde o fluxo para

---

**Última investigação realizada:** 21/01/2026  
**Arquivos verificados:** agentOrchestratorService.ts, chatThreadService.ts, multiAgentTypes.ts, SidebarChat.tsx, convertToLLMMessageService.ts