# 🛠️ Solução para Erro Gemini: `thought_signature`

Este documento descreve como corrigir o erro **400 Bad Request** do Gemini via Pollinations, que ocorre quando o modelo exige um `thought_signature` mas o formato enviado é rejeitado.

## 📝 O Problema
Ao utilizar modelos Gemini com ferramentas (tools) habilitadas, a API pode retornar:
> *Error: 400 vertex-ai error: Unable to submit request because function call `search_in_file` ... is missing a `thought_signature`*

## 🚀 A Solução (Resumo)
Implementamos um **Fallback Automático**: 
1. O sistema tenta enviar a mensagem com `thought_signature`.
2. Se o Gemini rejeitar com erro 400, o sistema detecta a mensagem específica.
3. O sistema reenvia a mensagem **automaticamente** sem o parâmetro problemático.
4. O usuário recebe a resposta sem interrupções.

---

## 🛠️ Como aplicar a correção manualmente

Se você precisar reaplicar esta correção no arquivo `src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts`:

### 1. Localize o bloco de erro do OpenAI
Procure por `.catch(error => {` dentro da função `_sendOpenAICompatibleChat`.

### 2. Substitua pelo código de Fallback:

```typescript
// No arquivo: src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts

.catch(error => {
    const errorMessage = error?.message || '';
    const statusCode = error?.status;

    // ✨ Fallback para Gemini/Pollinations: Erro de thought_signature
    if (statusCode === 400 && errorMessage.includes('thought_signature')) {
        console.log('[PolliDev] Gemini rejeitou thought_signature. Tentando novamente sem...');
        
        const retryOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
            model: modelName,
            messages: messages as any,
            stream: true,
            ...nativeToolsObj, // Mantém as ferramentas
            ...additionalOpenAIPayload
            // REMOVE o thoughtSignaturePayload aqui
        };

        return openai.chat.completions.create(retryOptions)
            .then(async response => {
                _setAborter(() => response.controller.abort());
                let rFullText = '';
                let rFullReasoning = '';
                let rToolName = '';
                let rToolId = '';
                let rToolParamsStr = '';

                for await (const chunk of response) {
                    const newText = chunk.choices[0]?.delta?.content ?? '';
                    rFullText += newText;
                    for (const tool of chunk.choices[0]?.delta?.tool_calls ?? []) {
                        if (tool.index === 0) {
                            rToolName += tool.function?.name ?? '';
                            rToolParamsStr += tool.function?.arguments ?? '';
                            rToolId += tool.id ?? '';
                        }
                    }
                    onText({
                        fullText: rFullText,
                        fullReasoning: rFullReasoning,
                        toolCall: !rToolName ? undefined : { name: rToolName, rawParams: {}, isDone: false, doneParams: [], id: rToolId },
                    });
                }
                const retryToolCall = rawToolCallObjOfParamsStr(rToolName, rToolParamsStr, rToolId);
                onFinalMessage({ fullText: rFullText, fullReasoning: rFullReasoning, anthropicReasoning: null, toolCall: retryToolCall });
            })
            .catch(retryError => {
                onError({ message: retryError + '', fullError: retryError });
            });
    }

    // Erro normal
    if (error instanceof OpenAI.APIError && error.status === 401) {
        onError({ message: invalidApiKeyMessage(providerName), fullError: error });
    } else {
        onError({ message: error + '', fullError: error });
    }
})
```

---

## 📂 Arquivos Gerados
- `thought_signature_fix.ts`: Contém o código TypeScript pronto para ser colado.
- `GEMINI_THOUGHT_SIGNATURE_FIX_GUIDE.md`: Este guia explicativo.

## ✅ Benefícios
- **Resiliência**: O sistema não "trava" mais ao usar modelos Gemini.
- **Transparência**: O usuário nem percebe que houve um erro, apenas recebe a resposta.
- **Compatibilidade**: Mantém o suporte a `thought_signature` onde ele funcionar, e remove apenas quando falhar.

---
*PolliDev Multi-Agent System*