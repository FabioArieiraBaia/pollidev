# 📋 PLANO CONSOLIDADO: Sistema Multi-Agente Pollidev

> **Última atualização:** 21/01/2026  
> **Documento Compilado de:** `continuar_implementacao.md` + `andamento.md` + `docu_avacada.md` + `README.md`

---

## 📚 ÍNDICE

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Estado Atual da Implementação](#2-estado-atual-da-implementação)
3. [Arquitetura Técnica](#3-arquitetura-técnica)
4. [Fluxo de Dados Completo](#4-fluxo-de-dados-completo)
5. [Problema Identificado](#5-problema-identificado)
6. [Investigação Pendente](#6-investigação-pendente)
7. [Plano de Correção Detalhado](#7-plano-de-correção-detalhado)
8. [Arquivos-Chave](#8-arquivos-chave)
9. [Comandos de Investigação](#9-comandos-de-investigação)
10. [Critérios de Sucesso](#10-critérios-de-sucesso)
11. [Riscos e Cuidados](#11-riscos-e-cuidados)
12. [Próximos Passos](#12-próximos-passos)
13. [Documentação de Prompts](#13-documentação-de-prompts)
14. [Ferramentas Disponíveis](#14-ferramentas-disponíveis)
15. [Sistema de Logging](#15-sistema-de-logging)

---

## 1. Visão Geral do Projeto

### 1.1 O que é o PolliDev?

**PolliDev** é um editor de código avançado com inteligência artificial integrada, baseado no VS Code.

### 🌟 Características Principais

- **🤖 Agentes de IA Integrados** - Use modelos de IA diretamente no editor
- **🔍 Busca Semântica RAG** - Sistema de busca semântica com Retrieval Augmented Generation
- **💾 Checkpoint de Mudanças** - Visualize e gerencie alterações no código
- **🔌 Múltiplos Modelos** - Suporte para OpenAI, Anthropic, Gemini, Ollama, vLLM e mais
- **🏠 Modelos Locais** - Execute modelos localmente (Ollama, LM Studio, etc.)
- **🌐 Automação de Navegador** - Ferramentas integradas para automação web
- **🎯 Indexação Semântica** - Indexe seu workspace para busca inteligente

### 🌸 Integração com Pollinations.ai

- 🎨 **Geração de Imagens** - Crie imagens diretamente no editor
- 💬 **IA de Texto** - Acesso nativo à API de texto do Pollinations
- 🔄 **Multi-Modelos** - Suporte para GPT, Claude, Llama e mais
- ⚡ **Streaming em Tempo Real** - Respostas em tempo real
- 🆓 **API Gratuita** - Aproveite os recursos sem custo

---

## 2. Estado Atual da Implementação

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

### 🔄 Arquitetura de Agentes Implementada

1. **Orquestrador (The Architect):** Gerencia o fluxo de trabalho, delega tarefas e sintetiza a resposta final.
2. **Pesquisador (Context Explorer):** Especialista em varredura de arquivos, busca semântica e análise de dependências.
3. **Desenvolvedor (Coder):** Focado na geração de código, refatoração e aplicação de lógica.
4. **Revisor (Quality Gate):** Valida o código gerado, verifica erros de linting e conformidade com padrões.

---

## 3. Arquitetura Técnica

### 3.1 Componentes Chave

#### A. `AgentOrchestratorService.ts` (O Cérebro)
- **`_contexts`**: Um `Map` que mantém o estado de cada conversa (arquivos alterados, erros, comandos). Isso permite que o Agente 2 saiba o que o Agente 1 fez.
- **`_callLLM`**: Método centralizado para chamadas de IA. Ele configura os `OverridesOfModel` para garantir que o compilador aceite as chamadas para diferentes provedores (OpenAI, Anthropic, etc.).
- **`_executeTask`**: Gerencia o ciclo de vida de uma tarefa: `PENDING` -> `IN_PROGRESS` -> `COMPLETED/FAILED`.

#### B. `multiAgentProjectPlanner.ts` (A Visualização)
- **`generateDashboardMarkdown`**: Gera o template inicial do .md. Usa spans com classes neon para efeito visual.
- **`updateTaskStatusInMarkdown`**: Usa **Expressões Regulares (Regex)** para localizar uma tarefa específica pelo ID dentro do arquivo de texto e substituir apenas a linha do status, preservando o resto do documento.

---

## 4. Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE EXECUÇÃO POLLIDEV               │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │   User Input     │
    └────────┬─────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  chat_userMessageContent()                               │
    │  - Combina instruções + SELECTIONS do usuário            │
    │  - Lê arquivos selecionados                               │
    │  - Gera contexto de pastas (directoryStr)               │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  chat_systemMessage()                                     │
    │  - Gera prompt do sistema com:                           │
    │    • Contexto do workspace                               │
    │    • Ferramentas disponíveis (filtered by mode)         │
    │    • Regras específicas do modo                          │
    │    • Arquitetura do projeto                               │
    │    • Browser MCP tools (se applicable)                  │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  Ferramentas Enviadas para LLM                           │
    │  - XML format (includeXMLToolDefinitions = true)         │
    │  - OU OpenAI-style function calling                      │
    │  - OU textual description (toolsDescriptionText)          │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  LLM Processing (Pollinations.ai)                        │
    │  - OpenAI, Anthropic, Claude, Gemini, etc.               │
    │  - Streaming responses                                   │
    │  - Multimodal (vision, audio, video)                     │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  Tool Calls → Results → Continue                        │
    │  - LLM decide ferramentas usar                           │
    │  - Sistema executa ferramentas                          │
    │  - Resultados retornados ao LLM                         │
    │  - Processo repete até task completa                    │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  Final Response                                         │
    │  - SEARCH/REPLACE blocks para edits                    │
    │  - Código gerado                                        │
    │  - Explicações markdown                                 │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  Edit Application                                       │
    │  - edit_file aplica SEARCH/REPLACE blocks               │
    │  - lint errors verificados                               │
    │  - User feedback loop                                   │
    └─────────────────────────────────────────────────────────┘
```

### 4.1 O Fluxo Multi-Agente

1. **Entrada (UI)**: O usuário envia uma mensagem via `ChatThreadService` no modo `multi-agent`.
2. **Intercepção**: O `ChatThreadService` delega a execução para o `AgentOrchestratorService.processRequest()`.
3. **Análise de Stack**: O orquestrador verifica as tecnologias (React, Node, etc.). Se incerto, ele usa o `addAgentMessage` para perguntar ao usuário.
4. **Planejamento**: O `Planner` (dentro do orquestrador) gera um objeto `AgentPlan` contendo uma lista de `AgentTask`.
5. **Dashboard**: O `MultiAgentProjectPlanner` cria o arquivo `PROJECT_STATUS.md` com estilos CSS Neon injetados.
6. **Execução**:
   - **Sequencial**: Tarefa A -> Tarefa B.
   - **Paralela**: O orquestrador usa `Promise.all` para disparar até `maxConcurrentAgents` tarefas simultâneas que não possuem dependências entre si.

---

## 5. Problema Identificado

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

### Como as ferramentas (Tools) funcionam atualmente:

Atualmente, o Agente Executor recebe instruções via prompt do sistema informando que ele **pode** usar ferramentas. No entanto, a execução real ainda é simulada via `executeTool`.

**O que o Agente vê no System Prompt:**
> "Você tem acesso a: read_file, edit_file, browser_navigate... Quando precisar usar, descreva a ação."

---

## 6. Investigação Pendente

### 6.1 AgentToolsService
```
Verificar se existe: src/vs/workbench/contrib/void/browser/agentToolsServiceImpl.ts
Verificar registro: void.contribution.ts deve importar este arquivo
```

### 6.2 System Prompt
```
Localização provável: common/prompt/prompts.ts ou agentOrchestratorService.ts
Verificar: O prompt instrui a LLM a usar formato estruturado?
```

### 6.3 Loop de Execução
```
Arquivo: agentOrchestratorService.ts
Verificar: Existe while loop para re-tentar após executar ferramenta?
Linhas relevantes: _runAgentTask(), próximo de linha 519
```

### 6.4 Ferramentas Disponíveis
```
Verificar quais ferramentas estão definidas:
- create_file
- edit_file
- read_file
- run_command
- browser_navigate
```

---

## 7. Plano de Correção Detalhado

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

### 🟡 Passo 5: Integração Real com IToolsService (ALTA PRIORIDADE)

**Onde:** `AgentOrchestratorService.ts` -> método `_runAgentTask`.

**O que fazer:**
1. Injetar o `IToolsService` no construtor.
2. Modificar o `_runAgentTask` para detectar se a resposta do LLM contém uma chamada de ferramenta (formato XML ou JSON).
3. Chamar `this._toolsService.runTool(name, params)`.
4. Pegar o resultado (ex: conteúdo do arquivo lido) e enviar de volta para o LLM para que ele finalize a tarefa.

### 🟢 Passo 6: Conectar com a Barra Lateral (UI Agentes)

**Onde:** `src/vs/workbench/contrib/void/browser/react/src/multi-agent-tsx/`

**O que fazer:**
1. Criar um `listener` no serviço para que a UI React seja notificada sempre que o `_contexts` mudar.
2. Mapear as tarefas do `AgentPlan` para o componente `AgentChecklist.tsx`.

---

## 8. Arquivos-Chave

```
src/vs/workbench/contrib/void/
├── common/
│   ├── agentOrchestratorService.ts    ← PRINCIPAL (parser + loop)
│   ├── agentToolsService.ts           ← Interface (verificar se existe)
│   ├── multiAgentTypes.ts             ← ✅ OK
│   ├── multiAgentProjectPlanner.ts    ← Dashboard visualization
│   ├── prompt/prompts.ts              ← System prompts
│   └── voidSettingsTypes.ts           ← Settings types
├── browser/
│   ├── agentToolsServiceImpl.ts       ← Implementação (criar se não existir)
│   ├── void.contribution.ts           ← Registro de serviços
│   ├── chatThreadService.ts           ← Integração com chat
│   ├── convertToLLMMessageService.ts   ← Message conversion
│   └── react/
│       ├── src/multi-agent-tsx/       ← ✅ OK (UI funciona)
│       │   ├── AgentChecklist.tsx
│       │   ├── ActiveAgentsView.tsx
│       │   └── index.tsx
│       └── src/agent-manager-tsx/     ← Agent management UI
│           ├── AgentManager.tsx
│           └── index.tsx
└── test/
    └── common/
        └── prompt/                   ← Tests for prompts
            ├── askMode.test.ts
            ├── debugMode.test.ts
            └── planMode.test.ts
```

---

## 9. Comandos de Investigação

```powershell
# Ver estrutura completa da pasta void
Get-ChildItem -Path "src\vs\workbench\contrib\void" -Recurse -Name | Select-String "agent"

# Procurar por AgentToolsService
Select-String -Path "src\vs\workbench\contrib/void\**\*.ts" -Pattern "AgentToolsService" -Recurse

# Procurar registros de singleton
Select-String -Path "src\vs\workbench\contrib/void\**\*.ts" -Pattern "registerSingleton" -Recurse

# Ver o system prompt atual
Select-String -Path "src\vs\workbench\contrib/void\**\*.ts" -Pattern "system.*prompt|SYSTEM_PROMPT" -Recurse

# Compilar após mudanças
npm run compile

# Rodar para testar
.\scripts\code.bat

# Modo watch (recompila automaticamente)
npm run watch

# Compilar React components
npm run buildreact
```

---

## 10. Critérios de Sucesso

O sistema estará funcionando quando:

1. ✅ Usuário digita: "Crie um arquivo hello.txt com 'Hello World'"
2. ✅ LLM responde com formato XML: `<tool_call>create_file</tool_call>...`
3. ✅ Parser detecta a tool call corretamente
4. ✅ AgentToolsService executa e cria o arquivo
5. ✅ Resultado volta para LLM
6. ✅ LLM confirma: "Arquivo criado com sucesso!"
7. ✅ UI mostra checklist de ações executadas

---

## 11. Riscos e Cuidados

1. **Dependência Circular:** Nunca importar de `browser/` em `common/`
   - **Solução:** Sempre use `createDecorator` e injeção de dependência via construtor, ou `dynamic import()` dentro de métodos assíncronos.

2. **Registro de Serviço:** O `registerSingleton` DEVE estar no arquivo que é importado por `void.contribution.ts`

3. **Permissões de Arquivo:** O AgentToolsService precisa de acesso ao IFileService

4. **Rate Limiting:** Implementar delay entre iterações do loop para não sobrecarregar a LLM

5. **Segurança:** Validar paths de arquivo para evitar escrita fora do workspace

6. **Tipos do Void:** O objeto `OverridesOfModel` em `voidSettingsTypes.ts` é rígido. Se você adicionar um novo provedor de IA, precisa atualizar esse tipo ou o `AgentOrchestrator` não compilará.

7. **Buffer de Arquivo:** Ao escrever no Dashboard, use `VSBuffer.fromString()` para converter a string para o formato que o `IFileService` aceita.

8. **Regex no Markdown:** O método de atualização do Dashboard depende da estrutura exata do ID. Se mudar o layout do MD, precisa ajustar a Regex em `multiAgentProjectPlanner.ts`.

---

## 12. Próximos Passos

### 12.1 Ações Imediatas

1. [ ] Verificar se `agentToolsService.ts` (interface) existe em `common/`
2. [ ] Verificar se `agentToolsServiceImpl.ts` existe em `browser/`
3. [ ] Localizar o system prompt atual no `agentOrchestratorService.ts`
4. [ ] Verificar a estrutura do método `_runAgentTask`
5. [ ] Testar com logs detalhados para ver onde o fluxo para

### 12.2 Guia para Terminar a Implementação

#### Alta Prioridade:
- [ ] Integração Real com IToolsService
- [ ] Implementação do loop de retry
- [ ] Melhoria do parser com fallback inteligente

#### Média Prioridade:
- [ ] Conectar UI React com estado do orquestrador
- [ ] Implementar Dashboard multi-agente visual
- [ ] Adicionar testes unitários

#### Baixa Prioridade:
- [ ] Documentar APIs internas
- [ ] Otimizar performance
- [ ] Adicionar internacionalização

---

## 13. Documentação de Prompts

### 13.1 Prompts por Modo

#### Modo Agent (Padrão)
```typescript
export const chat_systemMessage = async (instructions, modelCaps, flags) => {
    const availableTools = await getToolsDescriptionText(chatMode)
    const extraInstructions = getModeSystemPrompt(chatMode)
    
    return {
        role: 'system',
        content: `You are a professional developer... ${extraInstructions} ${availableTools}`
    }
}
```

#### Modo Multi-Agent
```typescript
export const chat_systemMessage = async (instructions, modelCaps, flags) => {
    // Inclui configuração de orquestração multi-agente
    const orchestratorPrompt = `
    You are an orchestrator agent responsible for delegating tasks.
    
    Available agents:
    - Researcher: Explores codebase, finds relevant files
    - Developer: Writes and edits code
    - Reviewer: Validates code quality
    
    When receiving a task:
    1. Analyze the request
    2. Break into subtasks
    3. Delegate to appropriate agents
    4. Synthesize results
    
    Use XML format for agent communication:
    <agent_call>agent_name</agent_call>
    <task>task_description</task>
    `
    
    return {
        role: 'system',
        content: orchestratorPrompt
    }
}
```

### 13.2 Diretrizes de Prompt Engineering

Cada agente opera sob um "System Prompt" rigoroso:

- **Orquestrador:** "Você é o gerente de projeto. Sua prioridade é decompor a solicitação do usuário em sub-tarefas atômicas."
- **Coder:** "Você é um engenheiro sênior. Escreva código limpo, seguindo o padrão DRY e SOLID. Sempre explique mudanças críticas."
- **Reviewer:** "Seja crítico. Procure por bugs latentes, problemas de performance e falhas de segurança."

---

## 14. Ferramentas Disponíveis

### 14.1 Ferramentas de Arquivo

| Ferramenta | Descrição | Parâmetros |
|------------|-----------|------------|
| `read_file` | Lê conteúdo de arquivo | `{uri, startLine?, endLine?, pageNumber?}` |
| `edit_file` | Edita arquivo | `{uri, searchReplaceBlocks}` |
| `rewrite_file` | Reescreve arquivo | `{uri, newContent}` |
| `create_file_or_folder` | Cria arquivo/pasta | `{uri, isFolder}` |
| `delete_file_or_folder` | Deleta arquivo/pasta | `{uri, isRecursive, isFolder}` |
| `ls_dir` | Lista diretório | `{uri, pageNumber}` |
| `get_dir_tree` | Estrutura de pastas | `{uri}` |
| `search_pathnames_only` | Busca por nome | `{query, includePattern?, pageNumber?}` |
| `search_for_files` | Busca por conteúdo | `{query, isRegex?, searchInFolder?, pageNumber?}` |
| `search_in_file` | Busca em arquivo | `{uri, query, isRegex}` |
| `read_lint_errors` | Verifica lint | `{uri}` |

### 14.2 Ferramentas de Terminal

| Ferramenta | Descrição | Parâmetros |
|------------|-----------|------------|
| `run_command` | Executa comando | `{command, cwd?, terminalId}` |
| `run_persistent_command` | Comando persistente | `{command, persistentTerminalId}` |
| `open_persistent_terminal` | Abre terminal | `{cwd?}` |
| `kill_persistent_terminal` | Fecha terminal | `{persistentTerminalId}` |

### 14.3 Ferramentas de Browser

| Ferramenta | Descrição | Parâmetros |
|------------|-----------|------------|
| `browser_navigate` | Navega para URL | `{url}` |
| `browser_click` | Clica em elemento | `{element, ref}` |
| `browser_type` | Digita texto | `{element, ref, text, submit?}` |
| `browser_snapshot` | Captura página | `{}` |
| `browser_screenshot` | Screenshot | `{fullPage?}` |
| `browser_hover` | Hover em elemento | `{element, ref}` |
| `browser_press_key` | Pressiona tecla | `{key}` |
| `browser_select_option` | Seleciona opção | `{element, ref, values}` |
| `browser_wait_for` | Espera condição | `{text?, textGone?, time?}` |

---

## 15. Sistema de Logging

### 15.1 Tags de Log

Os logs estão saliendo no Console do Desenvolvedor do VS Code (Help > Toggle Developer Tools). Procure por tags:

- `[MultiAgent]`
- `[AgentOrchestrator]`
- `[ToolCall]`
- `[LLM]`

### 15.2 Pontos de Logging

| Local | Mensagem | Dados |
|-------|----------|-------|
| prompts.ts:377 | availableTools: result | chatMode, toolsCount, names |
| prompts.ts:506 | getToolsDescriptionText: entry | mode, counts |
| prompts.ts:513 | getToolsDescriptionText: no tools | mode, 0 tools |
| prompts.ts:578 | chat_systemMessage: before getToolsDescriptionText | mode, flags |
| prompts.ts:739 | chat_systemMessage: before including toolsDescriptionText | flags |
| prompts.ts:742 | chat_systemMessage: final result | full message stats |

### 15.3 Agent Logging (throughout o código)

```typescript
fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        location: 'prompts.ts:377',
        message: 'availableTools: result',
        data: {
            chatMode,
            toolsCount: tools?.length || 0,
            toolsNames: tools?.map(t => t.name) || [],
            mcpToolsCount: mcpTools?.length || 0,
            hasBrowserTools: tools?.some(t => t.name?.includes('browser'))
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B'
    })
}).catch(() => {})
```

---

## 📝 Notas Adicionais

### Modos de Chat

| Modo | Ferramentas | Autonomia | Uso |
|------|-------------|-----------|-----|
| normal | leitura | baixa | Perguntas simples |
| gather | leitura | média | Pesquisa código |
| agent | todas | alta | Desenvolvimento |
| multi-agent | todas + MCP | orquestrador | Tasks complexas |

### Superpower Modes

| Modo | Quando usar | Características |
|------|-------------|-----------------|
| plan | Tasks complexas | Planeja antes de executar |
| debug | Corrigir bugs | Foco em erros |
| ask | Perguntas | Sem tools automáticas |

### Configurações Multi-Agent

```typescript
multiAgentSettings: {
    enabled: false,
    orchestratorModel: 'gemini-large',
    plannerModel: 'perplexity-reasoning',
    executorModels: ['qwen-coder', 'gemini-fast', 'openai-fast'],
    enableParallelExecution: true,
    maxConcurrentAgents: 3,
    autoApproveTasks: false,
    maxRetries: 2,
}
```

---

## 🔗 Referências

- **Documento Original:** `continuar_implementacao.md`
- **Relatório Técnico:** `andamento.md`
- **Documentação Avançada:** `docu_avacada.md`
- **README Principal:** `README.md`

---

**© 2025 Fabio Arieira Baia - PolliDev**

*Documento consolidado para implementação do sistema multi-agente*