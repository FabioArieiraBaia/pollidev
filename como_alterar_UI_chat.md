# Como Alterar a UI do Chat - Guia Completo

## Visão Geral

Este guia documenta como modificar a interface do usuário do chat no VS Code Void, seguindo os padrões do projeto e sem quebrar a aplicação.

---

## Estrutura do Projeto

### Arquitetura de Componentes React

```
src/vs/workbench/contrib/void/browser/react/src/
├── sidebar-tsx/              # Componentes do sidebar (Chat principal)
│   ├── SidebarChat.tsx      # Componente principal do chat
│   ├── Sidebar.tsx          # Sidebar container
│   └── ...
├── agent-manager-tsx/       # Gerenciador de agentes
│   ├── AgentManager.tsx     # Lista de agentes
│   └── index.tsx
├── void-editor-widgets-tsx/ # Widgets do editor
│   └── VoidCommandBar.tsx   # Barra de comandos (diffs)
└── styles.css               # Estilos globais e animações
```

---

## Padrões de Design do Projeto

### 1. Tailwind CSS com Scope (void-scope)

O projeto usa Tailwind CSS com um sistema de scoping para evitar conflitos:

```tsx
// Uso correto:
<div className="@@void-scope">
  <div className="p-4 bg-void-bg-2">...</div>
</div>

// O scope-tailwind processa para:
// @@void-scope → void-scope
// p-4 → void-p-4
// bg-void-bg-2 → void-bg-void-bg-2
```

### 2. Hooks Customizados

Os hooks seguem um padrão para acessar serviços VS Code:

```tsx
// Hooks disponíveis em services.tsx:
useIsDark()           // Detecta tema dark/light
useChatThreadsState()  // Estado dos threads
useThreadMetadataState() // Metadados persistentes
useFullChatThreadsStreamState() // Stream de estado
useAccessor()         // Acessor de serviços VS Code
```

### 3. Cores e Variáveis CSS

As cores são definidas em `styles.css` usando variáveis:

```css
/* Cores principais */
--void-bg-1: var(--vscode-input-background);
--void-bg-2: var(--vscode-sideBar-background);
--void-bg-3: var(--vscode-editor-background);

--void-fg-1: var(--vscode-editor-foreground);
--void-fg-2: var(--vscode-input-foreground);
--void-fg-3: var(--vscode-input-placeholderForeground);

--void-accent-1: #007FD4;  /* Azul principal */
--void-border-1: var(--vscode-commandCenter-activeBorder);
```

---

## Tipos de Alterações Seguras

### ✅ Alterações Seguras (Podem ser feitas sem riscos)

1. **Cores de botões e backgrounds**
   - Mudar `backgroundColor`, `color` em inline styles
   - Alterar classes Tailwind de cores (`bg-void-bg-*`, `text-void-fg-*`)

2. **Tamanhos e espaçamentos**
   - Padding: `p-2`, `p-4`, `px-3`, `py-1`
   - Margin: `m-2`, `mb-4`, `mt-2`
   - Gap: `gap-1`, `gap-2`

3. **Opacities e transições**
   - `opacity-50`, `hover:opacity-100`
   - `transition-all`, `duration-300`

4. **Animações e efeitos visuais**
   - Keyframes CSS
   - Hover effects
   - Box shadows

5. **Ícones**
   - Tamanho: `size-3`, `size-4`
   - Opacidade: `opacity-70`

---

### ⚠️ Alterações com Cuidado (Podem quebrar)

1. **Estrutura HTML/JSX**
   - Adicionar/remover tags `div`
   - Mudar ordem de elementos
   - Alterar `className` que afeta layout (grid, flex)

2. **Props de componentes**
   - Parâmetros esperados (`uri`, `editor`)
   - Estados de componentes

---

### ❌ Alterações Proibidas (Vão quebrar)

1. **Lógica de negócios**
   - `handleSwitchThread`, `handleDeleteThread`
   - Serviços: `IChatThreadService`, `IEditCodeService`

2. **Estrutura de dados**
   - `thread.id`, `thread.messages`
   - Estados: `pinnedThreads`, `activeThreads`

3. **Imports de serviços**
   - `accessor.get('IServiceName')`

---

## Guia Passo a Passo: Como Fazer Alterações

### Passo 1: Identificar o Arquivo Certo

| O que alterar | Arquivo |
|---------------|---------|
| Botões do chat | `sidebar-tsx/SidebarChat.tsx` |
| Lista de agentes | `agent-manager-tsx/AgentManager.tsx` |
| Botão novo agente | `agent-manager-tsx/AgentManager.tsx` |
| Barra de comandos | `void-editor-widgets-tsx/VoidCommandBar.tsx` |
| Estilos globais | `styles.css` |

### Passo 2: Abrir o Arquivo

Use o VS Code ou Editor de sua preferência:

```bash
code src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx
```

### Passo 3: Localizar o Componente

Procure pelo componente ou botão que deseja alterar:

```tsx
// Exemplo: botão de novo agente
const NovoAgenteButton = () => (
  <button
    onClick={handleNewAgent}
    className="px-2 py-1 bg-void-accent-1..."
  >
    + Novo Agente
  </button>
);
```

### Passo 4: Fazer a Alteração

#### Exemplo 1: Mudar cor de botão

```tsx
// ANTES:
<button className="bg-void-accent-1 text-white">

// DEPOIS (glass style):
<button
  className="glass-button"
  style={{
    background: 'linear-gradient(135deg, rgba(0,127,212,0.4) 0%, rgba(0,127,212,0.2) 100%)',
    border: '1px solid rgba(0,127,212,0.5)',
    backdropFilter: 'blur(8px)',
    color: '#007FD4',
  }}
>
```

#### Exemplo 2: Mudar tamanho

```tsx
// ANTES: padding grande
<div className="p-4">

// DEPOIS: padding menor
<div className="p-3">
```

#### Exemplo 3: Adicionar animação

```tsx
// Adicionar classe de hover
<button className="hover:scale-105 transition-all duration-300">
```

### Passo 5: Testar no Browser

1. Compile o projeto:
```bash
npm run compile
```

2. Abra o Void no navegador
3. Verifique se a UI carrega corretamente
4. Teste interações (cliques, hovers)

---

## Exemplos Práticos de Alterações

### Exemplo 1: Botão Glass Moderno

**Arquivo:** `VoidCommandBar.tsx`

```tsx
export const AcceptButton = ({ text, onClick }) => (
  <button
    className="glass-button neon-green"
    style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.4) 0%, rgba(16,185,129,0.2) 100%)',
      border: '1px solid rgba(16,185,129,0.5)',
      backdropFilter: 'blur(8px)',
      color: '#10B981',
      textShadow: '0 0 10px rgba(16,185,129,0.5)',
    }}
    onClick={onClick}
  >
    <Check size={14} />
    <span>{text}</span>
  </button>
);
```

### Exemplo 2: Botão de Navegação Glass

**Arquivo:** `VoidCommandBar.tsx`

```tsx
<button
  className="glass-icon-button"
  style={{
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(4px)',
  }}
  onClick={() => goNext()}
>
  <MoveRight className="size-3" />
</button>
```

### Exemplo 3: Lista Minimalista

**Arquivo:** `AgentManager.tsx`

```tsx
const ThreadItem = ({ thread }) => (
  <div
    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-void-bg-2/50 cursor-pointer"
  >
    <span className="text-xs opacity-50">•</span>
    <span className="flex-1 text-xs truncate">{thread.displayTitle}</span>
  </div>
);
```

---

## CSS Global - Animações e Efeitos

Adicione no arquivo `styles.css`:

```css
/* Animações Neon */
@keyframes neon-pulse {
  0%, 100% { box-shadow: 0 0 5px var(--neon-color), 0 0 10px var(--neon-color); }
  50% { box-shadow: 0 0 15px var(--neon-color), 0 0 25px var(--neon-color); }
}

.neon-green {
  --neon-color: #10B981;
  animation: neon-pulse 2s ease-in-out infinite;
}

.neon-red {
  --neon-color: #EF4444;
  animation: neon-pulse 2s ease-in-out infinite;
}

/* Botões Glass */
.glass-button {
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.glass-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s ease;
}

.glass-button:hover::before {
  left: 100%;
}

.glass-button:hover {
  transform: scale(1.05);
}

/* Ícones Glass */
.glass-icon-button {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(4px);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.glass-icon-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  transform: scale(1.05);
}

.glass-icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

---

## Checklist de Validação

Antes de finalizar alterações:

- [ ] Compile o projeto (`npm run compile`)
- [ ] Verifique se não há erros de lint
- [ ] Teste no navegador
- [ ] Verifique responsividade
- [ ] Teste interações (hover, clique)
- [ ] Confirme que não quebrou outras funcionalidades

---

## Comandos Úteis

```bash
# Compilar tudo
npm run compile

# Compilar apenas React (Tailwind)
cd src/vs/workbench/contrib/void/browser/react
node build.js

# Executar no Electron
npm run electron

# Limpar build
npm run clean
```

---

## Problemas Comuns e Soluções

### Erro: "Cannot find name 'X'"

**Causa:** Removeu um import mas ainda usa o componente

**Solução:** Verifique se removeu todas as referências

---

### Erro: "Property does not exist"

**Causa:** Usou CSS property inválido

**Solução:** Use apenas propriedades CSS válidas (ex: `text-shadow`, não `textShadow`)

---

### Alterações não aparecem

**Causa:** Não compilou o projeto

**Solução:** Execute `npm run compile`

---

## Suporte e Dúvidas

Para dúvidas sobre específicas:

1. Consulte a documentação do VS Code: https://code.visualstudio.com/api
2. Consulte Tailwind CSS: https://tailwindcss.com/docs
3. Verifique arquivos similares no projeto

---

**Última atualização:** 2026-01-20
**Versão:** 1.0.0