# Documentação: Implementação da Aba de Gerenciamento de Agentes

## Visão Geral

Este documento detalha a implementação completa da janela auxiliar de gerenciamento de agentes (Agent Manager) no VS Code Void, incluindo a correção dos problemas de estilos e a integração com o sistema de views do VS Code.

## Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Estrutura de Arquivos](#estrutura-de-arquivos)
3. [Implementação do Serviço de Metadados](#implementação-do-serviço-de-metadados)
4. [Componente React AgentManager](#componente-react-agentmanager)
5. [Integração com VS Code Views](#integração-com-vs-code-views)
6. [Correção dos Estilos](#correção-dos-estilos)
7. [Problemas Encontrados e Soluções](#problemas-encontrados-e-soluções)
8. [Processo de Build](#processo-de-build)
9. [Testes e Validação](#testes-e-validação)

---

## Visão Geral da Arquitetura

A implementação segue o padrão arquitetural do VS Code Void, utilizando:

- **Serviços VS Code**: `IStorageService` para persistência de dados
- **React Components**: Componentes funcionais com hooks
- **VS Code Views**: Sistema de views containers e view panes
- **Dependency Injection**: Sistema de injeção de dependências do VS Code
- **Tailwind CSS**: Estilização com escopo `void-scope`

### Fluxo de Dados

```
VS Code View Container
    ↓
AgentManagerViewPane (ViewPane)
    ↓
mountAgentManager (mountFnGenerator)
    ↓
AgentManager (React Component)
    ↓
useThreadMetadataState (React Hook)
    ↓
IThreadMetadataService
    ↓
IStorageService (Persistência)
```

---

## Estrutura de Arquivos

### Arquivos Criados

```
void/src/vs/workbench/contrib/void/
├── browser/
│   ├── agentManager.contribution.ts      # Registro da view no container
│   ├── agentManagerPane.ts               # ViewPane que hospeda o React
│   ├── threadMetadataService.ts          # Serviço de persistência de metadados
│   └── react/
│       └── src/
│           └── agent-manager-tsx/
│               ├── AgentManager.tsx      # Componente principal React
│               └── index.tsx             # Entry point de montagem
└── common/
    └── storageKeys.ts                    # Chave de storage (atualizado)
```

### Arquivos Modificados

```
void/src/vs/workbench/contrib/void/browser/
├── react/
│   ├── src/util/services.tsx             # Adicionado hook useThreadMetadataState
│   ├── src2/util/services.tsx            # Versão processada (atualizado manualmente)
│   ├── src2/agent-manager-tsx/           # Versão processada pelo scope-tailwind
│   └── tsup.config.js                    # Adicionado entry point agent-manager-tsx
├── void.contribution.ts                  # Import do threadMetadataService
└── sidebarPane.ts                        # Container já existente (reutilizado)
```

---

## Implementação do Serviço de Metadados

### 1. Interface do Serviço (`threadMetadataService.ts`)

```typescript
export interface ThreadMetadata {
    threadId: string;
    isPinned?: boolean;
    isArchived?: boolean;
    customTitle?: string;
}

export interface IThreadMetadataService {
    readonly onDidChangeMetadata: Event<{ threadId: string }>;
    getMetadata(threadId: string): ThreadMetadata | undefined;
    getAllMetadata(): ThreadMetadataMap;
    setMetadata(threadId: string, metadata: Partial<Omit<ThreadMetadata, 'threadId'>>): void;
    deleteMetadata(threadId: string): void;
    pinThread(threadId: string): void;
    unpinThread(threadId: string): void;
    archiveThread(threadId: string): void;
    unarchiveThread(threadId: string): void;
    setCustomTitle(threadId: string, title: string | undefined): void;
    isPinned(threadId: string): boolean;
    isArchived(threadId: string): boolean;
}
```

### 2. Implementação do Serviço

**Características principais:**

- **Persistência**: Usa `IStorageService` com `StorageScope.APPLICATION` e `StorageTarget.USER`
- **Eventos**: Emite eventos quando metadados são alterados
- **Singleton**: Registrado como singleton para acesso global
- **Carregamento Lazy**: Carrega metadados do storage apenas quando necessário

**Persistência dos dados:**

```typescript
private loadMetadata(): ThreadMetadataMap {
    const stored = this.storageService.get(THREAD_METADATA_STORAGE_KEY, StorageScope.APPLICATION);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return {};
        }
    }
    return {};
}

private saveMetadata(): void {
    this.storageService.store(
        THREAD_METADATA_STORAGE_KEY,
        JSON.stringify(this.metadataMap),
        StorageScope.APPLICATION,
        StorageTarget.USER
    );
}
```

### 3. Registro do Serviço

O serviço é registrado como singleton em `threadMetadataService.ts`:

```typescript
registerSingleton(IThreadMetadataService, ThreadMetadataService, InstantiationType.Delayed);
```

E importado em `void.contribution.ts` para garantir que seja carregado:

```typescript
import './threadMetadataService.js';
```

---

## Componente React AgentManager

### 1. Estrutura do Componente

O componente `AgentManager` é um componente funcional React que:

- Gerencia estado local para busca e hover
- Usa hooks customizados para acessar serviços VS Code
- Renderiza threads organizados em seções (Pinned, Agents, Archived)
- Implementa ações de gerenciamento (pin, archive, delete, duplicate)

### 2. Hooks Utilizados

```typescript
const threadsState = useChatThreadsState();           // Estado dos threads
const metadataState = useThreadMetadataState();       // Metadados persistentes
const fullThreadsStream = useFullChatThreadsStreamState(); // Stream completo
const accessor = useAccessor();                       // Acessor de serviços
const isDark = useIsDark();                          // Detecta tema dark/light
```

### 3. Organização dos Threads

Os threads são organizados em três seções:

1. **Pinned Threads**: Threads fixados pelo usuário
2. **Active Threads**: Threads ativos (não arquivados, não fixados)
3. **Archived Threads**: Threads arquivados pelo usuário

```typescript
const { pinnedThreads, activeThreads, archivedThreads } = useMemo(() => {
    // Filtragem e organização baseada em metadataState
}, [filteredThreads, metadataState]);
```

### 4. Funcionalidades Implementadas

- **Busca**: Filtra threads por título ou conteúdo
- **Pin/Unpin**: Fixa threads no topo da lista
- **Archive/Unarchive**: Move threads para seção arquivada
- **Delete**: Remove threads (implementado via serviço existente)
- **Duplicate**: Duplica threads (implementado via serviço existente)
- **Switch Thread**: Alterna para um thread específico

---

## Integração com VS Code Views

### 1. View Container

A view é registrada no container existente `VOID_VIEW_CONTAINER_ID`, que já estava configurado para o sidebar principal. Isso permite que a aba de agentes apareça no mesmo painel lateral.

### 2. AgentManagerViewPane

A classe `AgentManagerViewPane` estende `ViewPane`, seguindo o padrão do VS Code:

```typescript
export class AgentManagerViewPane extends ViewPane {
    protected override renderBody(parent: HTMLElement): void {
        super.renderBody(parent);
        parent.style.userSelect = 'text';
        
        this.instantiationService.invokeFunction(accessor => {
            const disposeFn = mountAgentManager(parent, accessor)?.dispose;
            this._register(toDisposable(() => disposeFn?.()));
        });
    }
    
    protected override layoutBody(height: number, width: number): void {
        super.layoutBody(height, width);
        this.element.style.height = `${height}px`;
        this.element.style.width = `${width}px`;
    }
}
```

**Características importantes:**

- **Dependency Injection**: Usa `IInstantiationService` para injetar dependências
- **Lifecycle Management**: Registra função de dispose para limpeza
- **Layout Responsivo**: Implementa `layoutBody` para ajustar tamanho

### 3. Registro da View

A view é registrada em `agentManager.contribution.ts`:

```typescript
viewsRegistry.registerViews([{
    id: VOID_AGENT_MANAGER_VIEW_ID,
    name: nls.localize2('agentManager', 'Agents'),
    ctorDescriptor: new SyncDescriptor(AgentManagerViewPane),
    canToggleVisibility: true,
    canMoveView: false,
    weight: 100,
    order: 0,
    when: undefined, // sempre visível
}], container);
```

### 4. Mount Function

A função `mountAgentManager` segue o padrão estabelecido no projeto:

```typescript
import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { AgentManager } from './AgentManager.js'

export const mountAgentManager = mountFnGenerator(AgentManager)
```

O `mountFnGenerator` é uma função utilitária que:
- Cria um root React
- Injeta serviços VS Code via context
- Retorna função de dispose para limpeza

---

## Correção dos Estilos

### Problema Identificado

A janela auxiliar abria e funcionava, mas os estilos não eram aplicados. Após investigação, identificamos três problemas principais:

1. **CSS não importado**: O arquivo `styles.css` não estava sendo importado
2. **Estrutura HTML incorreta**: A estrutura não seguia o padrão do Sidebar
3. **Classes Tailwind não processadas**: As classes não estavam sendo prefixadas corretamente

### Solução Implementada

#### 1. Import do CSS

Adicionado import do arquivo de estilos no componente:

```typescript
import '../styles.css';
```

**Importante**: O import deve estar **antes** do ErrorBoundary para garantir ordem correta.

#### 2. Estrutura HTML Correta

A estrutura final segue exatamente o padrão do Sidebar:

```tsx
return <div 
    className={`@@void-scope ${isDark ? 'dark' : ''}`}
    style={{ width: '100%', height: '100%' }}>
    <div
        // default background + text styles for agent manager
        className={`
            w-full h-full
            bg-void-bg-2
            text-void-fg-1
        `}>
        <div className={`w-full h-full ${className || ''}`}>
            <ErrorBoundary>
                {/* Conteúdo do componente */}
            </ErrorBoundary>
        </div>
    </div>
</div>;
```

**Elementos críticos:**

- **`@@void-scope`**: Prefixo especial processado pelo `scope-tailwind` para `void-scope`
- **`dark`**: Classe processada para `void-dark` quando o tema é dark
- **Wrapper duplo**: Duas divs intermediárias seguindo padrão do Sidebar
- **ErrorBoundary interno**: Dentro da estrutura, não envolvendo tudo

#### 3. Processamento do scope-tailwind

O `scope-tailwind` processa as classes:

- `@@void-scope` → `void-scope`
- `dark` → `void-dark` (quando dentro de `void-scope`)
- Classes Tailwind → `void-{classe}` (ex: `p-4` → `void-p-4`)

#### 4. Hook useIsDark

Adicionado hook para detectar tema atual:

```typescript
const isDark = useIsDark();
```

O hook monitora mudanças no `IThemeService` e atualiza o componente quando o tema muda.

### Estrutura Final Processada

Após processamento pelo `scope-tailwind`, a estrutura fica:

```tsx
<div className={`void-scope ${isDark ? "void-dark" : ""}`}>
    <div className="void-w-full void-h-full void-bg-void-bg-2 void-text-void-fg-1">
        <div className="void-w-full void-h-full">
            <ErrorBoundary>
                {/* Conteúdo */}
            </ErrorBoundary>
        </div>
    </div>
</div>
```

---

## Problemas Encontrados e Soluções

### Problema 1: Erro de Compilação - Hook Não Encontrado

**Erro:**
```
No matching export in "src2/util/services.tsx" for import "useThreadMetadataState"
```

**Causa:**
O arquivo `src2/util/services.tsx` é gerado automaticamente pelo `scope-tailwind`, e estava desatualizado.

**Solução:**
Atualização manual do arquivo `src2/util/services.tsx` para incluir:
- Import do `IThreadMetadataService`
- Estado global e listeners
- Hook `useThreadMetadataState`

**Nota**: Esta foi uma solução temporária. O ideal seria corrigir o `scope-tailwind` para processar corretamente, mas a atualização manual garante que o build funcione.

### Problema 2: Arquivo main.js Não Encontrado

**Erro:**
```
Error launching app
Unable to find Electron app at C:\xampp\htdocs\Void\void
Cannot find module 'C:\xampp\htdocs\Void\void\out\main.js'
```

**Causa:**
O build completo não havia sido executado. Apenas os componentes React foram compilados, mas os arquivos TypeScript principais não.

**Solução:**
Execução do build completo:
```bash
npm run compile
```

Isso compila todos os arquivos TypeScript em `src/` para `out/`, incluindo `main.ts` → `main.js`.

### Problema 3: Estilos Não Aplicados

**Erro:**
A janela abria e funcionava, mas sem estilos visuais.

**Causa:**
Três problemas combinados:
1. CSS não importado no componente
2. Estrutura HTML não seguia padrão do Sidebar
3. Classes Tailwind não estavam sendo aplicadas corretamente

**Solução:**
1. Adicionado `import '../styles.css'` no componente
2. Estrutura HTML ajustada para seguir padrão do Sidebar
3. Uso correto de `@@void-scope` e `dark` para processamento

### Problema 4: ErrorBoundary Posicionado Incorretamente

**Causa Inicial:**
O `ErrorBoundary` estava envolvendo o `void-scope`, quebrando a estrutura de estilos.

**Solução:**
Movido `ErrorBoundary` para dentro da estrutura, após as divs wrapper:

```tsx
// ❌ ERRADO
<ErrorBoundary>
    <div className="void-scope">...</div>
</ErrorBoundary>

// ✅ CORRETO
<div className="void-scope">
    <div>...
        <ErrorBoundary>
            {/* conteúdo */}
        </ErrorBoundary>
    </div>
</div>
```

### Problema 5: Ordem de Imports

**Causa:**
A ordem dos imports afetava o processamento do CSS pelo `tsup`.

**Solução:**
Import do CSS antes do ErrorBoundary:

```typescript
import '../styles.css';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
```

### Problema 6: Erro de Tipo Anthropic (media_type)

**Erro:**
```
Type 'string' is not assignable to type '"image/png" | "image/jpeg" | "image/gif" | "image/webp"'.
```

**Causa:**
O SDK da Anthropic exige um union type estrito para `media_type`.

**Solução:**
Correção em `sendLLMMessageTypes.ts` e `convertToLLMMessageService.ts` adicionando o union type e fazendo o cast necessário.

---

## Processo de Build Atualizado (Pasta void/)

### 1. Build do React

Os componentes React são processados em duas etapas:

#### Etapa 1: scope-tailwind

Processa arquivos em `src/` e gera `src2/` com classes Tailwind prefixadas:

```bash
cd src/vs/workbench/contrib/void/browser/react/
node build.js
```

**Processo:**
1. Executa `scope-tailwind` em `src/`
2. Gera `src2/` com classes prefixadas
3. Processa `styles.css` adicionando prefixo `void-`

#### Etapa 2: tsup

Bundles os componentes React usando `tsup`:

```javascript
// tsup.config.js
entry: [
    './src2/agent-manager-tsx/index.tsx', // ← Adicionado
    // ... outros entries
],
injectStyle: true, // ← CSS injetado no bundle
```

**Output:**
- `out/agent-manager-tsx/index.js` - Bundle completo com CSS injetado

### 2. Build do TypeScript Principal

Compila todos os arquivos TypeScript:

```bash
npm run compile
```

**Processo:**
1. Compila `src/` → `out/`
2. Gera `agentManagerPane.js`, `threadMetadataService.js`, etc.
3. Copia bundles React para `out/`

### 3. Estrutura de Diretórios de Build

```
out/
├── main.js                                    # Entry point principal
├── vs/
│   └── workbench/
│       └── contrib/
│           └── void/
│               └── browser/
│                   ├── agentManagerPane.js    # ViewPane compilado
│                   ├── threadMetadataService.js # Serviço compilado
│                   └── react/
│                       └── out/
│                           └── agent-manager-tsx/
│                               └── index.js   # Bundle React com CSS
```

### 4. Injeção de CSS

O `tsup` com `injectStyle: true` injeta o CSS no bundle JavaScript:

```javascript
// No bundle final (index.js)
function styleInject(css) {
    const style = document.createElement("style");
    style.type = "text/css";
    // ... injeta CSS no <head>
}

styleInject('.void-scope { ... } /* CSS completo */');
```

Isso garante que o CSS seja carregado automaticamente quando o módulo é importado.

---

## Integração com React Hooks

### Hook useThreadMetadataState

Criado hook customizado para acessar metadados de threads:

```typescript
export const useThreadMetadataState = () => {
    const [s, ss] = useState(threadMetadataState);
    useEffect(() => {
        ss(threadMetadataState);
        threadMetadataStateListeners.add(ss);
        return () => { threadMetadataStateListeners.delete(ss) };
    }, [ss]);
    return s;
};
```

**Características:**

- **Estado Global**: Usa estado global compartilhado entre componentes
- **Event Listeners**: Registra listeners para atualizações
- **Cleanup**: Remove listeners no unmount

**Registro no services.tsx:**

```typescript
// Estado global
let threadMetadataState: ThreadMetadataMap = {};
const threadMetadataStateListeners: Set<(s: ThreadMetadataMap) => void> = new Set();

// Registro do serviço
stateServices.threadMetadataService = accessor.get(IThreadMetadataService);

// Inicialização e listener
threadMetadataState = threadMetadataService.getAllMetadata();
disposables.push(
    threadMetadataService.onDidChangeMetadata(() => {
        threadMetadataState = threadMetadataService.getAllMetadata();
        threadMetadataStateListeners.forEach(l => l(threadMetadataState));
    })
);
```

---

## Testes e Validação

### Checklist de Validação

- [x] View aparece na barra lateral auxiliar
- [x] Estilos aplicados corretamente (cores, espaçamentos, layout)
- [x] Tema dark/light funciona corretamente
- [x] Busca de threads funciona
- [x] Pin/Unpin persiste após reiniciar
- [x] Archive/Unarchive persiste após reiniciar
- [x] Threads organizados em seções corretas
- [x] Ações (delete, duplicate, switch) funcionam
- [x] CSS injetado no bundle
- [x] Build completo sem erros

### Como Testar

1. **Executar build completo:**
   ```bash
   npm run buildreact  # Build React
   npm run compile     # Build TypeScript
   ```

2. **Iniciar aplicação:**
   ```bash
   npm run electron
   ```

3. **Verificar:**
   - Abrir barra lateral auxiliar
   - Verificar se aba "Agents" aparece
   - Testar funcionalidades (pin, archive, busca)
   - Verificar persistência (fechar e reabrir)
   - Verificar tema dark/light

### Debugging

**Verificar CSS injetado:**
```javascript
// No DevTools do navegador
document.querySelectorAll('style').forEach(s => {
    if (s.textContent.includes('void-scope')) {
        console.log('CSS encontrado:', s);
    }
});
```

**Verificar estrutura HTML:**
```javascript
// No DevTools
document.querySelector('.void-scope.void-dark'); // Deve retornar elemento
```

**Verificar serviços:**
```typescript
// No código
const accessor = useAccessor();
const metadataService = accessor.get(IThreadMetadataService);
console.log(metadataService.getAllMetadata());
```

---

## Próximos Passos e Melhorias Futuras

### Funcionalidades Pendentes

1. **Indicadores Visuais de Status:**
   - Ícone de "running" para threads em execução
   - Ícone de "awaiting_user" para threads aguardando input
   - Ícone ∞ para agent mode

2. **Melhorias de UI:**
   - Drag and drop para reordenar threads
   - Context menu com mais opções
   - Preview de threads ao hover

3. **Performance:**
   - Virtualização para listas grandes
   - Lazy loading de metadados
   - Debounce na busca

### Melhorias Técnicas

1. **Corrigir scope-tailwind:**
   - Resolver problema de `BABEL_PARSE_ERROR`
   - Automatizar atualização de `src2/util/services.tsx`

2. **Testes:**
   - Unit tests para `ThreadMetadataService`
   - Integration tests para `AgentManager`
   - E2E tests para fluxo completo

3. **Documentação:**
   - JSDoc em todas as funções públicas
   - Exemplos de uso
   - Guia de contribuição

---

## Conclusão

A implementação da aba de gerenciamento de agentes foi concluída com sucesso, seguindo os padrões arquiteturais do VS Code Void. Todos os problemas de estilos foram resolvidos, e a funcionalidade está totalmente integrada com o sistema de views e persistência do VS Code.

**Principais conquistas:**
- ✅ Integração completa com VS Code Views
- ✅ Persistência de metadados funcionando
- ✅ Estilos aplicados corretamente
- ✅ Tema dark/light suportado
- ✅ Build e deploy funcionando

**Lições aprendidas:**
- A estrutura HTML deve seguir exatamente o padrão do Sidebar
- O CSS deve ser importado na ordem correta
- O `scope-tailwind` precisa de atenção especial para hooks customizados
- O build completo é essencial para gerar todos os arquivos necessários

---

## Referências

- [VS Code Extension API - Views](https://code.visualstudio.com/api/extension-guides/tree-view)
- [React Hooks Documentation](https://react.dev/reference/react)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [VS Code Storage Service](https://github.com/microsoft/vscode/blob/main/src/vs/platform/storage/common/storage.ts)

---

**Última atualização:** 2025-01-XX
**Versão:** 1.0.0



