# ✅ CHECKLIST: Próximas Tarefas para Autonomia Total

## 📋 Prioridade 1: INTEGRAÇÃO IMEDIATA

### Task 1.1: Integrar Enriquecedor de Contexto no Service
**Status:** ⏳ PENDENTE  
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 2 horas

**O que fazer:**
- [ ] Editar `chatThreadService.ts`
- [ ] Importar `AgentContextEnhancer`
- [ ] Injetar no construtor
- [ ] Usar ao retornar resultado de snapshot

**Arquivo:** `src/vs/workbench/contrib/void/browser/chatThreadService.ts`

**Onde adicionar:**
```typescript
// Line ~100: Adicionar field privado
private _agentContextEnhancer: AgentContextEnhancer;

// Line ~150: Injetar no construtor
@ILogService logService: ILogService,
@IAgentContextEnhancer agentContextEnhancer: IAgentContextEnhancer, // NOVO

// Line ~200: Inicializar
this._agentContextEnhancer = agentContextEnhancer;

// Line ~500: Usar ao retornar snapshot
const enrichedSnapshot = await this._agentContextEnhancer.enrichSnapshot(
  snapshot,
  pattern
);
```

---

### Task 1.2: Registrar Serviços no Container de Injeção
**Status:** ⏳ PENDENTE  
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 1 hora

**O que fazer:**
- [ ] Encontrar `registerSingleton` em `serviceRegistry.ts` ou equivalente
- [ ] Registrar `AgentContextEnhancer`
- [ ] Registrar `BrowserStateTracker`
- [ ] Registrar `PagePatternDetector`
- [ ] Registrar `FailureAnalysisService`

**Buscar em:**
```bash
find src/ -name "*registry*.ts" -type f | grep void
# ou
grep -r "registerSingleton" src/vs/workbench/contrib/void --include="*.ts"
```

---

### Task 1.3: Configurar Interface Service
**Status:** ⏳ PENDENTE  
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 1 hora

**O que fazer:**
- [ ] Criar `iAgentContextEnhancer.ts` com interface `IAgentContextEnhancer`
- [ ] Criar exports em barrel files
- [ ] Garantir injeção funciona

---

## 📋 Prioridade 2: IMPLEMENTAÇÃO DE FEEDBACK LOOP

### Task 2.1: Criar Banco de Dados de Histórico
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟡 ALTA  
**Tempo Estimado:** 4 horas

**O que fazer:**
- [ ] Criar `navigationHistoryService.ts`
- [ ] Armazenar cada navegação com:
  - URL
  - Ações realizadas
  - Sucesso/Falha
  - Padrão detectado
  - Tempo decorrido

**Arquivo a criar:**
```
src/vs/workbench/contrib/void/common/navigationHistoryService.ts
```

**Estrutura:**
```typescript
interface NavigationRecord {
  id: string;
  url: string;
  timestamp: number;
  actions: BrowserAction[];
  success: boolean;
  pattern: PagePattern;
  durationMs: number;
  errorReason?: FailureReason;
}

class NavigationHistoryService {
  recordNavigation(record: NavigationRecord): Promise<void>
  getHistoryByPattern(pattern: string): Promise<NavigationRecord[]>
  getSuccessRate(pattern: string): number
  getAverageTime(pattern: string): number
}
```

---

### Task 2.2: Integrar Histórico com Rastreador de Estado
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟡 ALTA  
**Tempo Estimado:** 2 horas

**O que fazer:**
- [ ] Editar `browserStateTracker.ts`
- [ ] Adicionar registro de histórico
- [ ] Calcular taxa de sucesso
- [ ] Identificar padrões que falham

---

## 📋 Prioridade 3: RETRY INTELIGENTE

### Task 3.1: Implementar Retry com Fallback
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟡 ALTA  
**Tempo Estimado:** 3 horas

**O que fazer:**
- [ ] Editar `smartRetryService.ts`
- [ ] Implementar método `findElementByStrategy()`
- [ ] Testar cada estratégia em ordem:
  1. CSS Selector original
  2. XPath
  3. Texto visível
  4. ARIA role
  5. Elemento similar (fuzzy)

**Estratégia XPath:**
```typescript
async findByXPath(xpath: string): Promise<Element | null> {
  return await webContents.executeJavaScript(`
    const result = document.evaluate(
      ${JSON.stringify(xpath)},
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    result.singleNodeValue ? true : false
  `);
}
```

---

### Task 3.2: Adicionar Logging de Retry
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟡 ALTA  
**Tempo Estimado:** 1 hora

**O que fazer:**
- [ ] Log cada tentativa
- [ ] Log qual estratégia funcionou
- [ ] Log tempo de retry
- [ ] Alertar se todas falharem

---

## 📋 Prioridade 4: SUGESTÕES DE PRÓXIMOS PASSOS

### Task 4.1: Criar Serviço de Sugestões
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟡 MÉDIA  
**Tempo Estimado:** 3 horas

**O que fazer:**
- [ ] Criar `navigationSuggestionsService.ts`
- [ ] Analisar DOM para próximos passos lógicos
- [ ] Formular sugestões baseado em padrão

**Arquivo:**
```
src/vs/workbench/contrib/void/common/navigationSuggestionsService.ts
```

**Exemplo:**
```typescript
class NavigationSuggestionsService {
  suggestNextActions(
    elements: ElementInfo[],
    pattern: PagePattern,
    goal: string
  ): SuggestedAction[] {
    // Para login page: sugira "clique em forgot password" se necessário
    // Para search: sugira "digite no search box" depois "clique em search"
    // Para ecommerce: sugira "adicione ao carrinho" depois "vá para checkout"
  }
}
```

---

### Task 4.2: Integrar com Agente
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟡 MÉDIA  
**Tempo Estimado:** 2 horas

**O que fazer:**
- [ ] Editar `agentContextEnhancer.ts`
- [ ] Incluir `suggestedNextSteps` no output
- [ ] Fornecer ao LLM como dicas

---

## 📋 Prioridade 5: TESTES

### Task 5.1: Testes Unitários
**Status:** ⏳ PENDENTE  
**Prioridade:** 🔵 MÉDIA  
**Tempo Estimado:** 4 horas

**Arquivos a testar:**
- [ ] `domAnalysisService.test.ts`
- [ ] `browserStateTracker.test.ts`
- [ ] `pagePatternDetector.test.ts`
- [ ] `failureAnalysisService.test.ts`

**Estrutura:**
```
src/vs/workbench/contrib/void/test/
├── common/
│   ├── domAnalysisService.test.ts
│   ├── browserStateTracker.test.ts
│   ├── pagePatternDetector.test.ts
│   └── failureAnalysisService.test.ts
└── electron-main/
    └── smartRetryService.test.ts
```

---

### Task 5.2: Testes de Integração
**Status:** ⏳ PENDENTE  
**Prioridade:** 🔵 MÉDIA  
**Tempo Estimado:** 6 horas

**O que testar:**
- [ ] Navegação completa (login → search → resultado)
- [ ] Retry automático quando elemento não encontrado
- [ ] Detecção de padrão e sugestão de ação
- [ ] Feedback loop registrando sucesso/falha

---

### Task 5.3: Testes End-to-End
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟢 BAIXA  
**Tempo Estimado:** 8 horas

**Cenários:**
- [ ] Agente navega para GitHub
- [ ] Agente busca repositório
- [ ] Agente faz clone
- [ ] Tudo sem falhas

---

## 📋 Prioridade 6: UI E VISUALIZAÇÃO

### Task 6.1: Dashboard de Autonomia
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟢 BAIXA  
**Tempo Estimado:** 6 horas

**O que mostrar:**
- [ ] Taxa de sucesso do agente
- [ ] Padrões mais visitados
- [ ] Tempo médio por padrão
- [ ] Erros mais comuns
- [ ] Histórico de navegação

**Componente React:**
```
src/vs/workbench/contrib/void/browser/react/src2/autonomy-dashboard/
```

---

### Task 6.2: Panel de Contexto em Tempo Real
**Status:** ⏳ PENDENTE  
**Prioridade:** 🟢 BAIXA  
**Tempo Estimado:** 4 horas

**O que mostrar:**
- [ ] URL atual
- [ ] Padrão detectado
- [ ] Elementos encontrados
- [ ] Sugestões de próximos passos
- [ ] Status do retry

---

## 🎯 CRONOGRAMA RECOMENDADO

### Semana 1 (Esta semana)
- ✅ Task 1.1: Integrar enriquecedor (**FAZER AGORA**)
- ✅ Task 1.2: Registrar serviços (**FAZER AGORA**)
- ✅ Task 1.3: Configurar interface (**FAZER AGORA**)

### Semana 2
- ✅ Task 2.1: Banco de histórico
- ✅ Task 3.1: Retry inteligente
- ✅ Task 3.2: Logging de retry

### Semana 3
- ✅ Task 2.2: Integrar histórico
- ✅ Task 4.1: Serviço de sugestões
- ✅ Task 4.2: Integrar com agente

### Semana 4-5
- ✅ Task 5.1: Testes unitários
- ✅ Task 5.2: Testes integração
- ✅ Task 6.1: Dashboard

### Semana 6+
- ✅ Task 5.3: Testes E2E
- ✅ Task 6.2: Panel tempo real
- 🎯 Autonomia Total Alcançada!

---

## 📊 Status Visual

```
FASE 1: CONTEXTUALIZAÇÃO
████████░░ 60% ✅

FASE 2: INTELIGÊNCIA  
██░░░░░░░░ 20% (Tasks 3.1-4.2)

FASE 3: AUTONOMIA
░░░░░░░░░░  0% (Futuro)

TESTES & UI
░░░░░░░░░░  0% (Futuro)
```

---

## 🚀 PRÓXIMA AÇÃO

### ⚡ COMEÇAR AGORA:

```bash
cd c:\xampp\htdocs\Void

# 1. Procurar arquivo de registro de serviços
grep -r "registerSingleton\|registerService" src/vs/workbench/contrib/void --include="*.ts" | head -20

# 2. Procurar onde está ILogService
grep -r "ILogService" src/vs/workbench/contrib/void/browser --include="*.ts" | head -5

# 3. Procurar chatThreadService
find src/ -name "*chatThreadService.ts" -type f | grep -v test
```

---

## 📞 Suporte Rápido

### Dúvidas Comuns:

**P: Como injetar um novo serviço?**
A: Seguir o padrão em `chatThreadService.ts`:
```typescript
constructor(
  @IMyNewService myNewService: IMyNewService
) {
  this._myNewService = myNewService;
}
```

**P: Onde registrar serviço no container?**
A: Buscar por `registerSingleton` no projeto e seguir padrão

**P: Como testar localmente?**
A: 
```bash
npm run compile  # Compilar
npm run watch    # Esperar por mudanças
./scripts/code.bat  # Abrir
```

---

**Última Atualização:** 23 Jan 2026 - 19:45 UTC  
**Responsável:** Sistema de Autonomia do Navegador  
**Status Global:** 🟡 PARCIALMENTE IMPLEMENTADO
