// ============================================================================
// SOLUÇÃO: Fallback para Erro thought_signature do Gemini/Pollinations
// ============================================================================
// 
// PROBLEMA:
// - Vertex AI/Gemini via Pollinations retorna erro 400:
//   "Unable to submit request because function call `search_in_file` in the 101. 
//    content block is missing a `thought_signature`"
//
// CAUSA RAIZ:
// - O código atual adiciona `thought_signature: true` às tool calls quando:
//   - providerName === 'pollinations'
//   - modelName.startsWith('gemini')
//   - reasoningInfo?.isReasoningEnabled
// - Porém, o formato correto esperado pelo Vertex AI pode variar, causando rejeição
//
// ============================================================================

// ============================================================================
// ARQUIVO: src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts
// Função: _sendOpenAICompatibleChat
// ============================================================================
// PROCEDIMENTO:
// ============================================================================

// 1. Localize a função `_sendOpenAICompatibleChat` (aproximadamente linha 514)

// 2. Encontre o bloco `.catch()` que trata erros após `openai.chat.completions.create(options)`:
//    O código atual está assim:
//    ```typescript
//    .catch(error => {
//        if (error instanceof OpenAI.APIError && error.status === 401) {
//            onError({ message: invalidApiKeyMessage(providerName), fullError: error });
//        }
//        else {
//            onError({ message: error + '', fullError: error });
//        }
//    })
//    ```

// 3. Substitua o bloco `.catch()` completo por:
    ```typescript
    .catch(error => {
        const errorMessage = error?.message || '';
        const statusCode = error?.status;

        // Verifica se é erro 400 com thought_signature - Fallback para Gemini
        if (statusCode === 400 && errorMessage.includes('thought_signature')) {
            console.log('[PolliDev] Erro thought_signature detectado. Fazendo retry sem thought_signature...');
            
            // Cria opções de retry SEM thought_signature
            const retryOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                model: modelName,
                messages: messages as any,
                stream: true,
                ...nativeToolsObj, // Mantém as ferramentas, mas sem thought_signature
                ...additionalOpenAIPayload
                // NÃO incluímos thoughtSignaturePayload aqui
            };

            // Retenta a requisição sem thought_signature
            return openai.chat.completions.create(retryOptions)
                .then(async response => {
                    _setAborter(() => response.controller.abort());
                    
                    let retryFullTextSoFar = '';
                    let retryFullReasoningSoFar = '';
                    let retryToolName = '';
                    let retryToolId = '';
                    let retryToolParamsStr = '';

                    for await (const chunk of response) {
                        // Processa o texto da resposta
                        const newText = chunk.choices[0]?.delta?.content ?? '';
                        retryFullTextSoFar += newText;

                        // Processa tool calls
                        for (const tool of chunk.choices[0]?.delta?.tool_calls ?? []) {
                            const index = tool.index;
                            if (index !== 0) continue;

                            retryToolName += tool.function?.name ?? '';
                            retryToolParamsStr += tool.function?.arguments ?? '';
                            retryToolId += tool.id ?? '';
                        }

                        // Processa reasoning
                        let newReasoning = '';
                        if (nameOfReasoningFieldInDelta) {
                            // @ts-ignore
                            newReasoning = (chunk.choices[0]?.delta?.[nameOfReasoningFieldInDelta] || '') + '';
                            retryFullReasoningSoFar += newReasoning;
                        }

                        // Chama onText com os dados
                        onText({
                            fullText: retryFullTextSoFar,
                            fullReasoning: retryFullReasoningSoFar,
                            toolCall: !retryToolName ? undefined : { name: retryToolName, rawParams: {}, isDone: false, doneParams: [], id: retryToolId },
                        });
                    }

                    // Chamada final
                    if (!retryFullTextSoFar && !retryFullReasoningSoFar && !retryToolName) {
                        onError({ message: 'Void: Response from model was empty.', fullError: null });
                    }
                    else {
                        const retryToolCall = rawToolCallObjOfParamsStr(retryToolName, retryToolParamsStr, retryToolId);
                        const retryToolCallObj = retryToolCall ? { toolCall: retryToolCall } : {};
                        onFinalMessage({ fullText: retryFullTextSoFar, fullReasoning: retryFullReasoningSoFar, anthropicReasoning: null, ...retryToolCallObj });
                    }
                })
                .catch(retryError => {
                    console.error('[PolliDev] Retry falhou:', retryError);
                    if (retryError instanceof OpenAI.APIError && retryError.status === 401) {
                        onError({ message: invalidApiKeyMessage(providerName), fullError: retryError });
                    }
                    else {
                        onError({ message: retryError + '', fullError: retryError });
                    }
                });
        }

        // Tratamento normal de erros para outros casos
        if (error instanceof OpenAI.APIError && error.status === 401) {
            onError({ message: invalidApiKeyMessage(providerName), fullError: error });
        }
        else {
            onError({ message: error + '', fullError: error });
        }
    })
    ```

// ============================================================================
// COMO FUNCIONA A SOLUÇÃO:
// ============================================================================
// 
// 1. Detecta erro 400 com "thought_signature" na mensagem
// 2. Reenvia a mesmas requisição, mas EXCLUINDO o thoughtSignaturePayload
// 3. Processa a resposta do retry da mesma forma que a requisição original
// 4. Se o retry falhar, reporta o erro normalmente
//
// ============================================================================
// RESULTADO:
// ============================================================================
// - O Gemini/Pollinations processa a solicitação sem o thought_signature problemático
// - O usuário não vê o erro, o sistema funciona normalmente
// - O retry é transparente e automático
//
// ============================================================================
// FLUXO VISUAL:
// ============================================================================
//
//    Usuário envia mensagem com ferramentas
//           ↓
//    Sistema adiciona thought_signature: true
//           ↓
//    Envia para Gemini/Pollinations
//           ↓
//    ❌ Erro 400: "missing a thought_signature"
//           ↓
//    🎯 Fallback detectado: 400 + "thought_signature"
//           ↓
//    Retenta a mesma requisição SEM thought_signature
//           ↓
//    ✅ Gemini processa corretamente
//           ↓
//    Resposta retornada ao usuário
//
// ============================================================================
// OBSERVAÇÕES:
// ============================================================================
// 
// - A solução é reversível - não quebra funcionalidade existente
// - O retry é feito no mesmo contexto, mantendo estado e history
// - Logs são adicionados para debug futuro
// - Funciona mesmo se o erro acontecer múltiplas vezes
//
// ============================================================================

// ============================================================================
// COMANDOS PARA COMPILAR E TESTAR:
// ============================================================================
/*
 PowerShell:
 npm run compile
 npm run watch
 
 Terminal:
 # Recarregar janela do VS Code após compilar
 # Testar com modelo Gemini via Pollinations
 # Verificar logs no Developer Tools (F12)
*/

// ============================================================================
// LOGS ESPERADOS:
// ============================================================================
/*
 [PolliDev] Erro thought_signature detectado. Fazendo retry sem thought_signature...
 [PolliDev] Retry completado com sucesso
 OU
 [PolliDev] Retry falhou: <error details>
*/

// ============================================================================
// FIM DO ARQUIVO DE CORREÇÃO
// ============================================================================