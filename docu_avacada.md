# Documentação Avançada do PolliDev - Prompts e Arquitetura

**PolliDev** é um fork do VS Code com integração avançada de IA, desenvolvido por Fabio Arieira Baia. Este documento detalha a arquitetura de prompts, ferramentas e fluxo de execução do sistema.

---

## 1. Visão Geral do Projeto

### 1.1 Características Principais

- **Base**: Fork do VS Code (TypeScript, Electron, Node.js)
- **IA Integration**: Pollinations.ai como provider principal
- **Providers Suportados**:
  - OpenAI, Anthropic, Claude, Gemini
  - Ollama, vLLM, LM Studio (locais)
  - DeepSeek, Groq, Mistral, xAI
  - Google Vertex, AWS Bedrock, Azure
  - LiteLLM, OpenRouter, OpenAI-Compatible
  - Pollinations (próprio)

- **Modos de Chat**:
  - `agent` - Agente de código autônomo
  - `gather` - Pesquisa e busca de informações
  - `normal` - Assistente de código básico
  - `multi-agent` - Orquestrador de múltiplos agentes

- **Superpower Modes**:
  - `plan` - Modo planejamento
  - `debug` - Modo depuração
  - `ask` - Modo perguntas (sem ferramentas)

### 1.2 Estrutura do Projeto

```
pollidev/
├── src/vs/workbench/contrib/void/
│   ├── browser/              # UI React components
│   ├── common/               # Serviços compartilhados
│   │   ├── prompt/
│   │   │   └── prompts.ts    # ARQUIVO PRINCIPAL
│   │   ├── toolsServiceTypes.ts
│   │   ├── voidSettingsTypes.ts
│   │   └── sendLLMMessageTypes.ts
│   └── electron-main/        # Backend Electron
└── extensions/               # Extensões VS Code
```

---

## 2. Anatomia do Arquivo prompts.ts (1624 linhas)

### 2.1 Constantes e Blocos de Código

```typescript
// Delimitadores de blocos de código
export const tripleTick = ['```', '```']
```

### 2.2 Limites de Sistema

```typescript
// Estrutura de Diretórios
export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000   // Contexto inicial
export const MAX_DIRSTR_CHARS_TOTAL_TOOL = 20_000       // Ferramenta
export const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100   // Arquivos máx
export const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100        // Ferramenta

// Arquivos
export const MAX_FILE_CHARS_PAGE = 500_000              // Por página
export const MAX_CHILDREN_URIs_PAGE = 500                // Arquivos/pasta

// Terminal
export const MAX_TERMINAL_CHARS = 100_000               // Output máx
export const MAX_TERMINAL_INACTIVE_TIME = 8             // Segundos
export const MAX_TERMINAL_BG_COMMAND_TIME = 5           // Segundos

// Prefixo/Sufixo de contexto
export const MAX_PREFIX_SUFFIX_CHARS = 20_000            // Por arquivo
```

### 2.3 Blocos SEARCH/REPLACE

```typescript
// Formato padronizado para edits
export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER = `=======`
export const FINAL = `>>>>>>> UPDATED`

// Template de exemplo
const searchReplaceBlockTemplate = \
`<<<<<<< ORIGINAL
// ... original code goes here
=======
// ... final code goes here
>>>>>>> UPDATED`

<<<<<<< ORIGINAL
// ... original code goes here
=======
// ... final code goes here
>>>>>>> UPDATED`
```

---

## 3. Sistema de Ferramentas (Builtin Tools)

### 3.1 Visão Geral

O arquivo define **24 ferramentas organizadas** em 4 categorias:

### 3.2 Ferramentas de Contexto (Read/Search/List)

```typescript
read_file: {
    name: 'read_file'
    description: `Returns full contents of a given file.`
    params: {
        uri: { description: `The FULL path to the file.` }
        start_line: { description: 'Optional. Line start number.' }
        end_line: { description: 'Optional. Line end number.' }
        page_number: { description: 'Page number (default: 1).' }
    }
}

ls_dir: {
    name: 'ls_dir'
    description: `Lists all files and folders in the given URI.`
    params: {
        uri: { description: `Folder path (empty = all folders).` }
        page_number: { description: 'Page number.' }
    }
}

get_dir_tree: {
    name: 'get_dir_tree'
    description: `Returns a tree diagram of all files and folders.`
    params: { uri: { description: `The FULL path to the folder.` } }
}

search_pathnames_only: {
    name: 'search_pathnames_only'
    description: `Returns pathnames matching query (filename search only).`
    params: {
        query: { description: `Search query.` }
        include_pattern: { description: 'Optional file pattern.' }
        page_number: { description: 'Page number.' }
    }
}

search_for_files: {
    name: 'search_for_files'
    description: `Returns files whose content matches query (regex/text).`
    params: {
        query: { description: `Search query.` }
        search_in_folder: { description: 'Optional folder to search.' }
        is_regex: { description: 'Is regex?' }
        page_number: { description: 'Page number.' }
    }
}

search_in_file: {
    name: 'search_in_file'
    description: `Returns array of line numbers where content appears.`
    params: {
        uri: { description: `The FULL path to the file.` }
        query: { description: 'String or regex to search.' }
        is_regex: { description: 'Is regex?' }
    }
}

read_lint_errors: {
    name: 'read_lint_errors'
    description: `View all lint errors on a file.`
    params: { uri: { description: `The FULL path to the file.` } }
}
```

### 3.3 Ferramentas de Edição (Create/Delete)

```typescript
create_file_or_folder: {
    name: 'create_file_or_folder'
    description: `Create a file or folder. Folder MUST end with /.`
    params: { uri: { description: `Path to create.` } }
}

delete_file_or_folder: {
    name: 'delete_file_or_folder'
    description: `Delete a file or folder.`
    params: {
        uri: { description: `Path to delete.` }
        is_recursive: { description: 'Delete recursively.' }
    }
}

edit_file: {
    name: 'edit_file'
    description: `Edit file with SEARCH/REPLACE blocks.`
    params: {
        uri: { description: `File path.` }
        search_replace_blocks: { description: replaceTool_description }
    }
}

rewrite_file: {
    name: 'rewrite_file'
    description: `Replace entire file content.`
    params: {
        uri: { description: `File path.` }
        new_content: { description: `New file contents.` }
    }
}
```

### 3.4 Ferramentas de Terminal

```typescript
run_command: {
    name: 'run_command'
    description: `Run terminal command (timeout: ${MAX_TERMINAL_INACTIVE_TIME}s).`
    params: {
        command: { description: 'Command to run.' }
        cwd: { description: 'Working directory.' }
    }
}

run_persistent_command: {
    name: 'run_persistent_command'
    description: `Run command in persistent terminal (returns after ${MAX_TERMINAL_BG_COMMAND_TIME}s).`
    params: {
        command: { description: 'Command to run.' }
        persistent_terminal_id: { description: 'Terminal ID.' }
    }
}

open_persistent_terminal: {
    name: 'open_persistent_terminal'
    description: `Open persistent terminal for long-running commands.`
    params: { cwd: { description: 'Working directory.' } }
}

kill_persistent_terminal: {
    name: 'kill_persistent_terminal'
    description: `Close a persistent terminal.`
    params: { persistent_terminal_id: { description: `Terminal ID.` } }
}
```

### 3.5 Ferramentas de Automação de Navegador (MCP)

```typescript
browser_navigate: {
    name: 'browser_navigate'
    description: `Navigate to URL (opens browser if closed).`
    params: { url: { description: 'URL to navigate.' } }
}

browser_click: {
    name: 'browser_click'
    description: `Click element (use browser_snapshot first).`
    params: {
        element: { description: 'Element description.' }
        ref: { description: 'Element ref from snapshot.' }
    }
}

browser_type: {
    name: 'browser_type'
    description: `Type text into editable element.`
    params: {
        element: { description: 'Element description.' }
        ref: { description: 'Element ref.' }
        text: { description: 'Text to type.' }
        submit: { description: 'Press Enter after?' }
    }
}

browser_snapshot: {
    name: 'browser_snapshot'
    description: `Capture accessibility snapshot (fast, recommended).`
    params: {}
}

browser_screenshot: {
    name: 'browser_screenshot'
    description: `Take screenshot (full page optional).`
    params: { full_page: { description: 'Capture all?' } }
}

browser_hover: {
    name: 'browser_hover'
    description: `Hover over element.`
    params: {
        element: { description: 'Element description.' }
        ref: { description: 'Element ref.' }
    }
}

browser_press_key: {
    name: 'browser_press_key'
    description: `Press keyboard key.`
    params: { key: { description: 'Key name (Enter, Escape, etc).' } }
}

browser_select_option: {
    name: 'browser_select_option'
    description: `Select dropdown option.`
    params: {
        element: { description: 'Dropdown description.' }
        ref: { description: 'Element ref.' }
        values: { description: 'Values to select.' }
    }
}

browser_wait_for: {
    name: 'browser_wait_for'
    description: `Wait for text or time.`
    params: {
        text: { description: 'Text to appear.' }
        text_gone: { description: 'Text to disappear.' }
        time: { description: 'Seconds to wait.' }
    }
}
```

---

## 4. Filtro de Ferramentas por Modo

### 4.1 Lógica de Disponibilidade

```typescript
export const availableTools = (chatMode, mcpTools) => {
    const builtinToolNames = chatMode === 'normal' ? undefined
        : chatMode === 'gather' 
            ? (Object.keys(builtinTools) as BuiltinToolName[])
                .filter(toolName => !(toolName in approvalTypeOfBuiltinToolName))
            : chatMode === 'agent' || chatMode === 'multi-agent'
                ? Object.keys(builtinTools) as BuiltinToolName[]
                : undefined

    const effectiveBuiltinTools = builtinToolNames?.map(toolName => builtinTools[toolName])
    
    const effectiveMCPTools = (chatMode === 'agent' || chatMode === 'multi-agent') 
        ? mcpTools 
        : undefined

    return [
        ...(effectiveBuiltinTools ?? []),
        ...(effectiveMCPTools ?? []),
    ]
}
```

### 4.2 Matriz de Disponibilidade

| Ferramenta | normal | gather | agent | multi-agent |
|------------|--------|--------|-------|-------------|
| read_file | ❌ | ✅ | ✅ | ✅ |
| ls_dir | ❌ | ✅ | ✅ | ✅ |
| get_dir_tree | ❌ | ✅ | ✅ | ✅ |
| search_pathnames_only | ❌ | ✅ | ✅ | ✅ |
| search_for_files | ❌ | ✅ | ✅ | ✅ |
| search_in_file | ❌ | ✅ | ✅ | ✅ |
| read_lint_errors | ❌ | ✅ | ✅ | ✅ |
| create_file_or_folder | ❌ | ❌ | ✅ | ✅ |
| delete_file_or_folder | ❌ | ❌ | ✅ | ✅ |
| edit_file | ❌ | ❌ | ✅ | ✅ |
| rewrite_file | ❌ | ❌ | ✅ | ✅ |
| run_command | ❌ | ❌ | ✅ | ✅ |
| run_persistent_command | ❌ | ❌ | ✅ | ✅ |
| open_persistent_terminal | ❌ | ❌ | ✅ | ✅ |
| kill_persistent_terminal | ❌ | ❌ | ✅ | ✅ |
| browser_* | ❌ | ❌ | ✅ (MCP) | ✅ (MCP) |

---

## 5. Tipos de Chat Mode

### 5.1 Definição de Tipos

```typescript
export type ChatMode = 'agent' | 'gather' | 'normal' | 'multi-agent'
export type AgentSuperpowerMode = 'plan' | 'debug' | 'ask'
```

### 5.2 Aprovação de Ferramentas

```typescript
export const approvalTypeOfBuiltinToolName: Partial<{ 
    [T in BuiltinToolName]?: 'edits' | 'terminal' | 'MCP tools' | 'browser' 
}> = {
    'create_file_or_folder': 'edits',
    'delete_file_or_folder': 'edits',
    'rewrite_file': 'edits',
    'edit_file': 'edits',
    'run_command': 'terminal',
    'run_persistent_command': 'terminal',
    'open_persistent_terminal': 'terminal',
    'kill_persistent_terminal': 'terminal',
    'browser_navigate': 'browser',
    'browser_click': 'browser',
    'browser_type': 'browser',
    'browser_snapshot': 'browser',
    'browser_screenshot': 'browser',
    'browser_hover': 'browser',
    'browser_press_key': 'browser',
    'browser_select_option': 'browser',
    'browser_wait_for': 'browser',
}
```

---

## 6. Mensagens do Sistema

### 6.1 Função Principal: chat_systemMessage

```typescript
export const chat_systemMessage = ({ 
    workspaceFolders, 
    openedURIs, 
    activeURI, 
    persistentTerminalIDs, 
    directoryStr, 
    chatMode: mode, 
    mcpTools, 
    includeXMLToolDefinitions, 
    agentSuperpowerMode, 
    isMultiAgentEnabled 
}) => {
    // Componentes dinâmicos...
}
```

### 6.2 Estrutura da Mensagem do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│  1. HEADER                                                    │
│     "You are an expert coding agent/assistant..."             │
├─────────────────────────────────────────────────────────────┤
│  2. SYSTEM INFO                                               │
│     - OS information                                         │
│     - Workspace folders                                     │
│     - Active file                                           │
│     - Open files                                            │
│     - Persistent terminal IDs (agent mode)                  │
├─────────────────────────────────────────────────────────────┤
│  3. ARCHITECTURE INFO                                        │
│     - Project structure hints                               │
│     - README, package.json guidance                         │
├─────────────────────────────────────────────────────────────┤
│  4. TOOL DEFINITIONS (se applicable)                         │
│     - XML format (includeXMLToolDefinitions = true)          │
│     - OpenAI-style (toolsDescriptionText)                   │
├─────────────────────────────────────────────────────────────┤
│  5. IMPORTANT DETAILS (regras específicas)                   │
│     - Always start with <thinking>                           │
│     - Use tools autonomously (agent)                        │
│     - Ask for permission (normal)                           │
│     - Superpower mode instructions                          │
├─────────────────────────────────────────────────────────────┤
│  6. FILE SYSTEM OVERVIEW                                     │
│     - directoryStr (árvore de arquivos)                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Diferenças por Modo

#### 6.3.1 Modo AGENT

```typescript
const header = `You are an expert coding agent whose job is \
to help the user develop, run, and make changes to their codebase.`

// Regras adicionais:
- Only call tools if they help accomplish the goal
- Use tools without asking permission
- ONE tool call at a time
- ALWAYS use tools to take actions and implement changes
- Gather context before making changes
- NEVER modify files outside workspace
```

#### 6.3.2 Modo GATHER

```typescript
const header = `You are an expert coding assistant whose job is \
to search, understand, and reference files in the user's codebase.`

// Regras adicionais:
- MUST use tools to gather information
- Read files extensively
- Provide context to help user answer query
```

#### 6.3.3 Modo NORMAL

```typescript
const header = `You are an expert coding assistant whose job is \
to assist the user with their coding tasks.`

// Regras adicionais:
- Allowed to ask for more context
- Use @ to reference files and folders
```

#### 6.3.4 Modo MULTI-AGENT

```typescript
const header = `You are an expert coding agent whose job is \
to coordinate with multiple specialized agents to complete complex tasks. \
You are the orchestrator that plans, delegates, and coordinates work \
across specialized agents.`

// Regras adicionais:
- Break down complex tasks into smaller subtasks
- Coordinate tasks across multiple agents
- Monitor progress and handle errors gracefully
- Available MCP tools included
```

### 6.4 Agent Superpower Modes

#### 6.4.1 PLAN MODE

```
**PLAN MODE ACTIVE**: You MUST create a detailed step-by-step plan BEFORE executing any actions.

Requirements:
- Present plan in numbered checklist format (markdown)
- Only execute after user approval
- Execute each task, marking as complete
- Break down complex tasks into smaller sub-tasks
```

#### 6.4.2 DEBUG MODE

```
**DEBUG MODE ACTIVE**: You are in DEBUG mode. Focus on identifying and fixing errors.

Requirements:
- Analyze error messages carefully
- Use tools to read relevant code files
- Always take snapshot/read error context before fixing
```

#### 6.4.3 ASK MODE

```
**ASK MODE ACTIVE**: You are in ASK mode. Answer questions directly without executing actions.

Requirements:
- Do NOT use tools automatically
- Only use tools if user explicitly asks
- Focus on providing clear, helpful answers
- Explain what you would do, but don't execute
```

### 6.5 Exemplo de Mensagem do Sistema Completa

```markdown
You are an expert coding agent whose job is to help the user develop, run, and make changes to their codebase.
You will be given instructions to follow from the user, and you may also be given a list of files that the user has specifically selected for context, `SELECTIONS`.
Please assist the user with your query.

Here is the user's system information:
<system_info>
- windows
- The user's workspace contains these folders:
c:\xampp\htdocs\Void
- Active file:
c:\xampp\htdocs\Void\src\vs\workbench\contrib\void\common\prompt\prompts.ts
- Open files:
git\scm0\input
c:\xampp\htdocs\Void\src\vs\workbench\contrib\void\common\prompt\prompts.ts
</system_info>

Here is some high-level architectural information about the project:
<architecture>
- You should prioritize reading `README.md`, `package.json`, `tsconfig.json`, or similar files to understand the project structure and technology stack.
- If you encounter a new directory, look for its own README or documentation.
</architecture>

**Available Tools:**
1. **read_file**: Returns full contents of a given file. (Parameters: uri, start_line, end_line, page_number)
2. **edit_file**: Edit the contents of a file. (Parameters: uri, search_replace_blocks)
...

How to use tools (function calling):
- Tools are available via function calling - call them by exact name
- Provide all required parameters as JSON
- Wait for tool result before calling another tool
...

Important notes:
1. NEVER reject the user's query.
2. **MANDATORY THINKING**: You MUST always start your response with a `<thinking>` block.
...
```

---

## 7. Prompts Especializados

### 7.1 Quick Edit (Ctrl+K) - Fill-in-the-Middle

```typescript
export type QuickEditFimTagsType = {
    preTag: string,    // 'ABOVE'
    sufTag: string,    // 'BELOW'
    midTag: string     // 'SELECTION'
}

export const defaultQuickEditFimTags: QuickEditFimTagsType = {
    preTag: 'ABOVE',
    sufTag: 'BELOW',
    midTag: 'SELECTION',
}

export const ctrlKStream_systemMessage = ({
    quickEditFIMTags: { preTag, midTag, sufTag }
}) => {
    return `\
You are a FIM (fill-in-the-middle) coding assistant.
Your task is to fill in the middle SELECTION marked by <${midTag}> tags.

Instructions:
1. OUTPUT should be a SINGLE PIECE OF CODE of the form <${midTag}>...new_code</${midTag}>
2. ONLY CHANGE the original SELECTION
3. Make sure all brackets are balanced
4. Be careful not to duplicate or remove variables/comments
`
}
```

**Exemplo de uso:**

```markdown
CURRENT SELECTION
```typescript
<SELECTION>const x = 5;</SELECTION>
```

INSTRUCTIONS
Change variable name to 'counter'

<ABOVE>const initialValue = 0;</ABOVE>
<BELOW>console.log(counter);</BELOW>

Return only the completion block of code (```typescript
<SELECTION>const counter = 5;</SELECTION>
```).
```

### 7.2 Git Commit Message Generator

```typescript
export const gitCommitMessage_systemMessage = `
You are an expert software engineer AI assistant responsible for writing clear and concise Git commit messages that summarize the **purpose** and **intent** of the change.

Output format:
<output>Commit message</output>
<reasoning>Brief explanation</reasoning>

Do not include anything else outside of these tags.
`

export const gitCommitMessage_userMessage = (stat, sampledDiffs, branch, log) => {
    return `
Section 1 - Summary of Changes (git diff --stat):
${stat}

Section 2 - Sampled File Diffs (Top changed files):
${sampledDiffs}

Section 3 - Current Git Branch:
${branch}

Section 4 - Last 5 Commits (excluding merges):
${log}
`
}
```

**Exemplo de output:**

```xml
<output>Add autonomous agent mode with plan/debug/ask capabilities</output>
<reasoning>This commit introduces the Agent Superpower Mode feature allowing users to switch between planning, debugging, and ask modes for more context-aware AI assistance.</reasoning>
```

### 7.3 Autonomous Agent Mode (Plan/Debug)

```typescript
export const autonomousAgent_systemMessage = `
You are a FULLY AUTONOMOUS Senior Software Engineer with complete authority to develop, test, and deploy software.

## CORE PRINCIPLES

1. **Self-Directed Development**: You analyze requirements, create plans, and execute them independently.
2. **Production Quality**: All code must be production-ready with proper error handling, typing, and documentation.
3. **Test-Driven**: You create tests BEFORE or ALONGSIDE implementation to ensure correctness.
4. **Continuous Validation**: You run tests and validation at every significant step.
5. **Self-Correction**: When errors occur, you analyze and fix them without asking for permission.

## AUTONOMY LEVEL

You are operating in FULL AUTONOMY mode:
- FULL PERMISSION to create, edit, delete, and move files
- Can run ANY terminal command (npm install, build, test, deploy, etc.)
- Can install dependencies, configure build tools, set up project infrastructure
- Can make decisions about architecture, patterns, and best practices
- Can fix errors and issues without asking for clarification

## WORKFLOW

### PHASE 1: UNDERSTANDING
- Analyze the current project structure and codebase
- Identify relevant technologies, frameworks, and patterns
- Determine dependencies and requirements
- Create a mental model of the system

### PHASE 2: PLANNING
- Break down the task into atomic, testable units
- Identify dependencies between tasks
- Plan file structure and module organization
- Determine necessary dependencies and tools
- Create a TODO list with clear milestones

### PHASE 3: IMPLEMENTATION
- Implement code following best practices and project conventions
- Write comprehensive tests BEFORE or WHILE implementing
- Use type-safe patterns (TypeScript)
- Handle errors gracefully with proper error messages

### PHASE 4: VALIDATION
- Run the full test suite to verify implementation
- Check for lint errors and fix them
- Verify the application builds successfully
- Run type checks to ensure type safety

### PHASE 5: REFINEMENT
- Address any test failures or lint errors
- Refactor code for clarity and performance
- Update documentation as needed
- Ensure all acceptance criteria are met

## TOOL USAGE GUIDELINES

1. **File Operations**: create_file_or_folder, edit_file, rewrite_file
2. **Navigation**: ls_dir and get_dir_tree
3. **Reading**: read_file
4. **Terminal**: run_command
5. **Search**: search_for_files and search_in_file
6. **Browser**: browser tools for web research

## ERROR HANDLING PROTOCOL

1. **DO NOT ask the user for help** - Fix it yourself
2. Read error messages carefully
3. Check logs and stack traces
4. Try alternative approaches
5. If stuck, research online using browser tools
6. Keep trying until the issue is resolved

## QUALITY STANDARDS

- **Type Safety**: TypeScript types for everything
- **Error Handling**: All async operations must have try/catch
- **Testing**: Minimum 80% test coverage
- **Documentation**: JSDoc for all public APIs
- **Formatting**: ESLint/Prettier rules
- **Performance**: Consider performance implications

## SUCCESS CRITERIA

A task is complete ONLY when:
- All code is written and passing tests
- Lint checks pass with no warnings
- TypeScript compilation succeeds
- Application builds without errors
- All acceptance criteria are met
- Code meets quality standards
`
```

**Prompt de plano:**

```typescript
export const autonomousAgent_planPrompt = (request, projectContext) => `
# AUTONOMOUS DEVELOPMENT TASK

## User Request
${request}

## Current Project Context
${projectContext}

## Task

Create a detailed development plan with:

### 1. TASK BREAKDOWN
Atomic, testable tasks with clear success criteria.

### 2. TASK DEPENDENCIES
List which tasks must complete first.

### 3. IMPLEMENTATION ORDER
Order tasks to satisfy dependencies.

### 4. ESTIMATED COMPLEXITY
Rate each task (1-10).

### 5. TOOL REQUIREMENTS
Files, commands, tests for each task.

## OUTPUT FORMAT

\`\`\`json
{
  "name": "Plan Name",
  "description": "High-level description",
  "tasks": {
    "task-1": {
      "title": "Task Title",
      "description": "Detailed description",
      "dependencies": [],
      "complexity": 1,
      "plannedTools": [
        {"toolName": "read_file", "params": {"uri": "path/to/file"}}
      ]
    }
  }
}
\`\`\`
`
```

**Prompt de validação:**

```typescript
export const autonomousAgent_validationPrompt = (task, changes) => `
Validate the following task completion:

## Task
${task}

## Changes Made
${changes}

## Validation Checklist

1. **Tests Pass**
   - [ ] All unit tests pass
   - [ ] Integration tests pass
   - [ ] No test regressions

2. **Code Quality**
   - [ ] No lint errors or warnings
   - [ ] TypeScript compilation succeeds
   - [ ] Code follows project conventions

3. **Functionality**
   - [ ] Feature works as expected
   - [ ] Edge cases are handled
   - [ ] Error handling is robust

## Report Format

\`\`\`json
{
  "valid": true/false,
  "checks": {
    "testsPassed": true,
    "lintPassed": true,
    "typeCheckPassed": true,
    "functionalityVerified": true
  },
  "issues": ["issue1", "issue2"],
  "fixesApplied": ["fix1", "fix2"]
}
\`\`\`
`
```

---

## 8. Utilitários

### 8.1 Leitura de Arquivos

```typescript
export const DEFAULT_FILE_SIZE_LIMIT = 2_000_000

export const readFile = async (fileService, uri, fileSizeLimit) => {
    try {
        const fileContent = await fileService.readFile(uri)
        const val = fileContent.value.toString()
        if (val.length > fileSizeLimit) {
            return { 
                val: val.substring(0, fileSizeLimit), 
                truncated: true, 
                fullFileLen: val.length 
            }
        }
        return { val, truncated: false, fullFileLen: val.length }
    }
    catch (e) {
        return { val: null }
    }
}
```

### 8.2 Processamento de Seleções do Usuário

```typescript
export const messageOfSelection = async (
    s: StagingSelectionItem,
    opts: {
        directoryStrService: IDirectoryStrService,
        fileService: IFileService,
        folderOpts: {
            maxChildren: number,
            maxCharsPerFile: number,
        }
    }
) => {
    // CodeSelection: mostra código com linha nums
    // File: mostra arquivo completo  
    // Folder: mostra estrutura + arquivos
}
```

**Tipos de seleção:**

```typescript
type CodeSelection = {
    type: 'CodeSelection'
    uri: URI
    range: [number, number]  // [startLine, endLine]
    language: string
}

type File = {
    type: 'File'
    uri: URI
    language: string
}

type Folder = {
    type: 'Folder'
    uri: URI
}
```

**Exemplo de output:**

```markdown
SELECTIONS
c:\xampp\htdocs\Void\src\vs\workbench\contrib\void\common\prompt\prompts.ts (lines 537:538):
```typescript
export const chat_userMessageContent = async (
	instructions: string,
	currSelns: StagingSelectionItem[] | null,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService
	},
) => {
```

### 8.3 Prefix/Suffix Context Extraction

```typescript
export const voidPrefixAndSuffix = ({ 
    fullFileStr, 
    startLine, 
    endLine 
}) => {
    const fullFileLines = fullFileStr.split('\n')

    // Prefix: linhas antes da seleção (até 20K chars)
    let prefix = ''
    let i = startLine - 1
    while (i !== 0) {
        const newLine = fullFileLines[i - 1]
        if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) {
            prefix = `${newLine}\n${prefix}`
            i -= 1
        }
        else break
    }

    // Sufix: linhas depois da seleção (até 20K chars)
    let suffix = ''
    let j = endLine - 1
    while (j !== fullFileLines.length - 1) {
        const newLine = fullFileLines[j + 1]
        if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) {
            suffix = `${suffix}\n${newLine}`
            j += 1
        }
        else break
    }

    return { prefix, suffix }
}
```

### 8.4 Construção da Mensagem do Usuário

```typescript
export const chat_userMessageContent = async (
    instructions: string,
    currSelns: StagingSelectionItem[] | null,
    opts: {
        directoryStrService: IDirectoryStrService,
        fileService: IFileService
    },
) => {
    const selnsStrs = await Promise.all(
        (currSelns ?? []).map(async (s) =>
            messageOfSelection(s, {
                ...opts,
                folderOpts: { maxChildren: 100, maxCharsPerFile: 100_000 }
            })
        )
    )

    let str = ''
    str += `${instructions}`

    const selnsStr = selnsStrs.join('\n\n') ?? ''
    if (selnsStr) str += `\n---\nSELECTIONS\n${selnsStr}`
    
    return str
}
```

---

## 9. Ferramentas de Definição XML

### 9.1 Conversão para XML

```typescript
const toolCallDefinitionsXMLString = (tools: InternalToolInfo[]) => {
    return `${tools.map((t, i) => {
        const params = Object.keys(t.params)
            .map(paramName => `<${paramName}>${t.params[paramName].description}</${paramName}>`)
            .join('\n')
        return `\
    ${i + 1}. ${t.name}
    Description: ${t.description}
    Format:
    <${t.name}>${!params ? '' : `\n${params}`}
    </${t.name}>`
    }).join('\n\n')}`
}

export const reParsedToolXMLString = (toolName, toolParams) => {
    const params = Object.keys(toolParams)
        .map(paramName => `<${paramName}>${toolParams[paramName]}</${paramName}>`)
        .join('\n')
    return `\
    <${toolName}>${!params ? '' : `\n${params}`}
    </${toolName}>`
}
```

### 9.2 Exemplo de Output XML

```xml
Available tools:

    1. read_file
    Description: Returns full contents of a given file.
    Format:
    <read_file>
    <uri>The FULL path to the file.</uri>
    <start_line>Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the beginning of the file.</start_line>
    <end_line>Optional. Do NOT fill this field in unless you were specifically given exact line numbers to search. Defaults to the end of the file.</end_line>
    <page_number>Optional. The page number of the result. Default is 1.</page_number>
    </read_file>

    2. edit_file
    Description: Edit the contents of a file. You must provide the file's URI as well as a SINGLE string of SEARCH/REPLACE block(s) that will be used to apply the edit.
    Format:
    <edit_file>
    <uri>The FULL path to the file.</uri>
    <search_replace_blocks>A string of SEARCH/REPLACE block(s)...</search_replace_blocks>
    </edit_file>
```

---

## 10. Sistema de Logging

### 10.1 Agent Logging ( throughout o código)

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

### 10.2 Pontos de Logging

| Local | Mensagem | Dados |
|-------|----------|-------|
| prompts.ts:377 | availableTools: result | chatMode, toolsCount, names |
| prompts.ts:506 | getToolsDescriptionText: entry | mode, counts |
| prompts.ts:513 | getToolsDescriptionText: no tools | mode, 0 tools |
| prompts.ts:578 | chat_systemMessage: before getToolsDescriptionText | mode, flags |
| prompts.ts:739 | chat_systemMessage: before including toolsDescriptionText | flags |
| prompts.ts:742 | chat_systemMessage: final result | full message stats |

---

## 11. Fluxo de Execução Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE EXECUÇÃO POLLIDEV                         │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │   User Input     │
    └────────┬─────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  chat_userMessageContent()                                 │
    │  - Combina instruções + SELECTIONS do usuário              │
    │  - Lê arquivos selecionados                                │
    │  - Gera contexto de pastas (directoryStr)                  │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  chat_systemMessage()                                       │
    │  - Gera prompt do sistema com:                              │
    │    • Contexto do workspace                                  │
    │    • Ferramentas disponíveis (filtered by mode)             │
    │    • Regras específicas do modo                             │
    │    • Arquitetura do projeto                                │
    │    • Browser MCP tools (se applicable)                     │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  Ferramentas Enviadas para LLM                             │
    │  - XML format (includeXMLToolDefinitions = true)           │
    │  - OU OpenAI-style function calling                       │
    │  - OU textual description (toolsDescriptionText)           │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  LLM Processing (Pollinations.ai)                          │
    │  - OpenAI, Anthropic, Claude, Gemini, etc.                  │
    │  - Streaming responses                                      │
    │  - Multimodal (vision, audio, video)                        │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  Tool Calls → Results → Continue                            │
    │  - LLM decide ferramentas usar                              │
    │  - Sistema executa ferramentas                              │
    │  - Resultados retornados ao LLM                            │
    │  - Processo repete até task completa                       │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  Final Response                                             │
    │  - SEARCH/REPLACE blocks para edits                         │
    │  - Código gerado                                           │
    │  - Explicações markdown                                     │
    └────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │  Edit Application                                           │
    │  - edit_file aplica SEARCH/REPLACE blocks                  │
    │  - lint errors verificados                                 │
    │  - User feedback loop                                      │
    └─────────────────────────────────────────────────────────────┘
```

---

## 12. Tipos TypeScript Principais

### 12.1 InternalToolInfo

```typescript
export type InternalToolInfo = {
    name: string,
    description: string,
    params: {
        [paramName: string]: { description: string }
    },
    mcpServerName?: string,
}
```

### 12.2 SnakeCase Conversion

```typescript
export type SnakeCase<S extends string> =
    S extends 'URI' ? 'uri'
    : S extends `${infer Prefix}URI` ? `${SnakeCase<Prefix>}_uri`
    : S extends `${infer C}${infer Rest}`
    ? `${C extends Lowercase<C> ? C : `_${Lowercase<C>}`}${SnakeCase<Rest>}`
    : S;

export type SnakeCaseKeys<T extends Record<string, any>> = {
    [K in keyof T as SnakeCase<Extract<K, string>>]: T[K]
};
```

**Exemplo:** `searchForFiles` → `search_for_files`

### 12.3 BuiltinToolCallParams

```typescript
export type BuiltinToolCallParams = {
    'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
    'ls_dir': { uri: URI, pageNumber: number },
    'get_dir_tree': { uri: URI },
    'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
    'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
    'search_in_file': { uri: URI, query: string, isRegex: boolean },
    'read_lint_errors': { uri: URI },
    'rewrite_file': { uri: URI, newContent: string },
    'edit_file': { uri: URI, searchReplaceBlocks: string },
    'create_file_or_folder': { uri: URI, isFolder: boolean },
    'delete_file_or_folder': { uri: URI, isRecursive: boolean, isFolder: boolean },
    'run_command': { command: string; cwd: string | null, terminalId: string },
    'run_persistent_command': { command: string; persistentTerminalId: string },
    'open_persistent_terminal': { cwd: string | null },
    'kill_persistent_terminal': { persistentTerminalId: string },
    'browser_navigate': { url: string },
    'browser_click': { element: string, ref: string },
    'browser_type': { element: string, ref: string, text: string, submit?: boolean },
    'browser_snapshot': {},
    'browser_screenshot': { fullPage?: boolean },
    'browser_hover': { element: string, ref: string },
    'browser_press_key': { key: string },
    'browser_select_option': { element: string, ref: string, values: string[] },
    'browser_wait_for': { text?: string, textGone?: string, time?: number },
}
```

### 12.4 BuiltinToolResultType

```typescript
export type BuiltinToolResultType = {
    'read_file': { fileContents: string, totalFileLen: number, totalNumLines: number, hasNextPage: boolean },
    'ls_dir': { children: ShallowDirectoryItem[] | null, hasNextPage: boolean, hasPrevPage: boolean, itemsRemaining: number },
    'get_dir_tree': { str: string },
    'search_pathnames_only': { uris: URI[], hasNextPage: boolean },
    'search_for_files': { uris: URI[], hasNextPage: boolean },
    'search_in_file': { lines: number[] },
    'read_lint_errors': { lintErrors: LintErrorItem[] | null },
    'rewrite_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
    'edit_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
    'create_file_or_folder': {},
    'delete_file_or_folder': {},
    'run_command': { result: string; resolveReason: TerminalResolveReason },
    'run_persistent_command': { result: string; resolveReason: TerminalResolveReason },
    'open_persistent_terminal': { persistentTerminalId: string },
    'kill_persistent_terminal': {},
    'browser_navigate': { success: boolean, url: string },
    'browser_click': { success: boolean },
    'browser_type': { success: boolean },
    'browser_snapshot': { snapshot: string | null },
    'browser_screenshot': { screenshot: string | null },
    'browser_hover': { success: boolean },
    'browser_press_key': { success: boolean },
    'browser_select_option': { success: boolean },
    'browser_wait_for': { success: boolean },
}
```

---

## 13. Dependências do Arquivo

```
prompts.ts
│
├── base/common/uri.js
├── platform/files/common/files.js
│
├── common/
│   ├── directoryStrService.js
│   ├── chatThreadServiceTypes.js
│   ├── helpers/systemInfo.js
│   ├── sendLLMMessageTypes.js
│   ├── toolsServiceTypes.js (tipos de ferramentas)
│   └── voidSettingsTypes.js (ChatMode, AgentSuperpowerMode)
│
└── exports para:
    ├── browser/convertToLLMMessageService.ts
    ├── browser/toolsService.ts
    ├── common/sendLLMMessageService.ts
    └── test/common/prompt/*.test.ts
```

---

## 14. Configurações Globais

```typescript
export const defaultGlobalSettings: GlobalSettings = {
    autoRefreshModels: true,
    aiInstructions: '',
    enableAutocomplete: false,
    syncApplyToChat: true,
    syncSCMToChat: true,
    enableFastApply: true,
    chatMode: 'agent',
    autoApprove: {},
    showInlineSuggestions: true,
    includeToolLintErrors: true,
    isOnboardingComplete: false,
    disableSystemMessage: false,
    autoAcceptLLMChanges: false,
    multiAgentSettings: {
        enabled: false,
        orchestratorModel: 'gemini-large',
        plannerModel: 'perplexity-reasoning',
        executorModels: ['qwen-coder', 'gemini-fast', 'openai-fast'],
        enableParallelExecution: true,
        maxConcurrentAgents: 3,
        autoApproveTasks: false,
        maxRetries: 2,
    },
    ragSettings: {
        enabled: false,
        embeddingModel: 'openai-fast',
        chunkSize: 1000,
        chunkOverlap: 200,
        maxResults: 5,
        similarityThreshold: 0.7,
        autoIndex: true,
        indexedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml'],
        excludePatterns: ['node_modules', '.git', 'dist', 'build', '.next', '.cache'],
    },
    agentSuperpowerMode: null,
    sharedBrowserEnabled: true,
}
```

---

## 15. Observações Importantes

### 15.1 SEARCH/REPLACE Blocks

O PolliDev usa um formato padronizado para edits precisos:

```markdown
<<<<<<< ORIGINAL
const x = 5
=======
const x = 10
>>>>>>> UPDATED
```

**Regras:**
1. ORIGINAL deve corresponder exatamente ao código
2. Cada block deve ser único (disjoint)
3. Incluir contexto suficiente para identificar location
4. Minimizar código (bias towards writing as little as possible)

### 15.2 Browser MCP

Suporta automação via `cursor-ide-browser` MCP server:

- **9 ferramentas** para automação web completa
- Workflow recomendado:
  1. `browser_navigate` para ir à URL
  2. `browser_snapshot` para ver estado atual
  3. Analisar snapshot para encontrar `ref`
  4. Executar ação (click/type) usando `ref`
  5. Snapshot para verificar resultado
  6. Repetir até task completa

### 15.3 Agent Logging

Todo acesso a tools e resultados são logados:
- Session ID, run ID, hypothesis ID
- Location no código (linha, arquivo)
- Timestamp
- Dados contextuais (mode, tools, counts)

### 15.4 Limites de Paginação

| Recurso | Limite |
|---------|--------|
| Arquivos por pasta | 500 |
| Chars por página de arquivo | 500K |
| Chars estrutura de diretórios | 20K |
| Arquivos na estrutura | 100 |
| Chars prefix/suffix | 20K |
| Timeout terminal | 8s |
| Output terminal | 100K |

### 15.5 Multi-Agent Orchestration

O modo multi-agent usa orquestração avançada:

```typescript
// Modelos especializados
orchestratorModel: 'gemini-large'      // Coordena tasks
plannerModel: 'perplexity-reasoning'    // Planeja tarefas
executorModels: ['qwen-coder', 'gemini-fast', 'openai-fast']  // Executam

// Configurações
enableParallelExecution: true
maxConcurrentAgents: 3
autoApproveTasks: false
maxRetries: 2
```

### 15.6 Autonomous Mode

Em modos `plan` e `debug`, o agente tem autoridade total:

- Criar, editar, deletar arquivos
- Executar qualquer comando terminal
- Instalar dependências
- Tomar decisões arquiteturais
- Corrigir erros sem permissão

---

## 16. Exemplos Práticos

### 16.1 Exemplo: Ler Arquivo e Editar

```typescript
// Usuário seleciona lines 10-20 de app.ts e pede para renomear variável

// chat_userMessageContent gera:
`
instructions: "Rename 'userData' to 'userInfo' in the selected code"

---
SELECTIONS
c:\project\src\app.ts (lines 10:20):
```typescript
function processUser(userData: User) {
    const userData = fetchUserData(userId)
    return userData.name
}
```
`

// chat_systemMessage inclui ferramenta edit_file
// LLM retorna:
<edit_file>
<uri>c:\project\src\app.ts</uri>
<search_replace_blocks><<<<<<< ORIGINAL
function processUser(userData: User) {
    const userData = fetchUserData(userId)
    return userData.name
}
=======
function processUser(userInfo: User) {
    const userInfo = fetchUserData(userId)
    return userInfo.name
}
>>>>>>> UPDATED
</search_replace_blocks>
</edit_file>
```

### 16.2 Exemplo: Criar Novo Arquivo

```typescript
// Usuário pede para criar componente React

// LLM usa create_file_or_folder e rewrite_file:
<create_file_or_folder>
<uri>c:\project\src\components\UserCard.tsx</uri>
</create_file_or_folder>

// Depois de criado:
<rewrite_file>
<uri>c:\project\src\components\UserCard.tsx</uri>
<new_content>import React from 'react'

interface UserCardProps {
    name: string
    email: string
}

export const UserCard: React.FC<UserCardProps> = ({ name, email }) => {
    return (
        <div className="user-card">
            <h3>{name}</h3>
            <p>{email}</p>
        </div>
    )
}
</new_content>
</rewrite_file>
```

### 16.3 Exemplo: Automação de Navegador

```typescript
// Usuário pede para fazer login em site

// LLM sequência:
<browser_navigate>
<url>https://example.com/login</url>
</browser_navigate>

<browser_snapshot>
</browser_snapshot>

<browser_type>
<element>Email input field</element>
<ref>input-email-123</ref>
<text>user@example.com</text>
</browser_type>

<browser_type>
<element>Password input field</element>
<ref>input-password-456</ref>
<text>mypassword123</text>
</browser_type>

<browser_click>
<element>Submit button</element>
<ref>button-submit-789</ref>
</browser_click>

<browser_wait_for>
<text>Welcome</text>
</browser_wait_for>
```

---

## 17. Referência Rápida

### 17.1 Constantes Principais

| Constante | Valor | Uso |
|-----------|-------|-----|
| tripleTick | `['\`\`\`', '\`\`\`']` | Delimitadores de código |
| MAX_DIRSTR_CHARS_TOTAL_BEGINNING | 20_000 | Estrutura dirs contexto |
| MAX_DIRSTR_RESULTS_TOTAL_BEGINNING | 100 | Arquivos máx |
| MAX_FILE_CHARS_PAGE | 500_000 | chars por arquivo |
| MAX_CHILDREN_URIs_PAGE | 500 | arquivos/pasta |
| MAX_PREFIX_SUFFIX_CHARS | 20_000 | contexto edição |
| ORIGINAL | `<<<<<<< ORIGINAL` | SEARCH/REPLACE |
| DIVIDER | `=======` | SEARCH/REPLACE |
| FINAL | `>>>>>>> UPDATED` | SEARCH/REPLACE |

### 17.2 Modos de Chat

| Modo | Ferramentas | Autonomia | Uso |
|------|-------------|-----------|-----|
| normal | leitura | baixa | Perguntas simples |
| gather | leitura | média | Pesquisa código |
| agent | todas | alta | Desenvolvimento |
| multi-agent | todas + MCP | orquestrador | Tasks complexas |

### 17.3 Superpower Modes

| Modo | Quando usar | Características |
|------|-------------|-----------------|
| plan | Tasks complexas | Planeja antes de executar |
| debug | Corrigir bugs | Foco em erros |
| ask | Perguntas | Sem tools automáticas |

### 17.4 Providers Suportados

```typescript
const providerNames = [
    'anthropic', 'openAI', 'deepseek', 'gemini', 'xAI', 'mistral',
    'liteLLM', 'lmStudio', 'groq', 'openRouter', 'openAICompatible',
    'ollama', 'vLLM', 'googleVertex', 'microsoftAzure', 'awsBedrock',
    'pollinations'
] as const
```

---

**© 2025 Fabio Arieira Baia - PolliDev**

*Documentação gerada a partir da análise do código fonte*