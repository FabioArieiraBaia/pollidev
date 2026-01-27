/*---------------------------------------------------------------------------------------------
 *  PolliDev - Sistema Inteligente de Compressão de Conversas
 *  
 *  Este serviço gerencia conversas longas de forma inteligente para evitar:
 *  - Sobrecarga de tokens no contexto
 *  - Perda de informações importantes
 *  - Lentidão nas respostas
 *  
 *  Estratégias:
 *  1. Manter últimas N mensagens intactas (recentes são mais relevantes)
 *  2. Resumir mensagens antigas (preservar decisões importantes)
 *  3. Preservar "pins" (system, tool results críticos, arquivos atuais)
 *  4. Compressão progressiva (quanto mais antiga, mais comprimida)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ChatMessage } from '../common/chatThreadServiceTypes.js';

// Configurações de compressão
const COMPRESSION_CONFIG = {
	// Número de mensagens recentes a manter intactas
	RECENT_MESSAGES_TO_KEEP: 10,
	
	// Limiar de tokens para iniciar compressão (60% do contexto)
	TOKEN_THRESHOLD_RATIO: 0.6,
	
	// Estimativa de caracteres por token
	CHARS_PER_TOKEN: 4,
	
	// Tamanho máximo de resumo por mensagem antiga
	MAX_SUMMARY_LENGTH: 200,
	
	// Mensagens de tool que devem ser preservadas (críticas)
	CRITICAL_TOOLS: ['edit_file', 'create_file_or_folder', 'delete_file_or_folder', 'run_command'],
	
	// Intervalo de mensagens para criar checkpoint de resumo
	CHECKPOINT_INTERVAL: 20,
};

export interface ConversationSummary {
	/** Resumo textual das mensagens antigas */
	summary: string;
	/** Número de mensagens resumidas */
	messageCount: number;
	/** Timestamp do resumo */
	timestamp: number;
	/** Decisões importantes identificadas */
	keyDecisions: string[];
	/** Arquivos modificados */
	filesModified: string[];
}

export interface CompressionResult {
	/** Mensagens comprimidas/processadas */
	messages: ChatMessage[];
	/** Resumo gerado (se houve compressão) */
	summary?: ConversationSummary;
	/** Tokens economizados estimados */
	tokensSaved: number;
	/** Se houve compressão */
	wasCompressed: boolean;
}

export interface IConversationCompressorService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Comprime uma conversa se necessário
	 * @param messages Mensagens da conversa
	 * @param contextWindow Tamanho da janela de contexto do modelo
	 * @param existingSummary Resumo existente (se houver)
	 * @returns Resultado da compressão
	 */
	compressConversation(
		messages: ChatMessage[],
		contextWindow: number,
		existingSummary?: ConversationSummary
	): CompressionResult;
	
	/**
	 * Estima o número de tokens de uma mensagem
	 */
	estimateTokens(message: ChatMessage): number;
	
	/**
	 * Estima o total de tokens de uma conversa
	 */
	estimateTotalTokens(messages: ChatMessage[]): number;
	
	/**
	 * Gera um resumo de mensagens
	 */
	generateSummary(messages: ChatMessage[]): ConversationSummary;
	
	/**
	 * Verifica se a conversa precisa de compressão
	 */
	needsCompression(messages: ChatMessage[], contextWindow: number): boolean;
}

export const IConversationCompressorService = createDecorator<IConversationCompressorService>('ConversationCompressorService');

class ConversationCompressorService extends Disposable implements IConversationCompressorService {
	_serviceBrand: undefined;

	constructor() {
		super();
	}

	/**
	 * Estima tokens de uma mensagem
	 */
	estimateTokens(message: ChatMessage): number {
		let content = '';
		
		if (message.role === 'user') {
			content = message.content;
		} else if (message.role === 'assistant') {
			content = message.displayContent || '';
		} else if (message.role === 'tool') {
			content = message.content + JSON.stringify(message.rawParams || {});
		}
		
		return Math.ceil(content.length / COMPRESSION_CONFIG.CHARS_PER_TOKEN);
	}

	/**
	 * Estima total de tokens da conversa
	 */
	estimateTotalTokens(messages: ChatMessage[]): number {
		return messages.reduce((total, msg) => total + this.estimateTokens(msg), 0);
	}

	/**
	 * Verifica se precisa compressão
	 */
	needsCompression(messages: ChatMessage[], contextWindow: number): boolean {
		const totalTokens = this.estimateTotalTokens(messages);
		const threshold = contextWindow * COMPRESSION_CONFIG.TOKEN_THRESHOLD_RATIO;
		return totalTokens > threshold;
	}

	/**
	 * Identifica mensagens críticas que não devem ser comprimidas
	 */
	private _isCriticalMessage(message: ChatMessage, index: number, totalMessages: number): boolean {
		// Mensagens recentes são críticas
		if (index >= totalMessages - COMPRESSION_CONFIG.RECENT_MESSAGES_TO_KEEP) {
			return true;
		}
		
		// Mensagens de ferramentas críticas
		if (message.role === 'tool' && COMPRESSION_CONFIG.CRITICAL_TOOLS.includes(message.name)) {
			return true;
		}
		
		// Checkpoints são críticos
		if (message.role === 'checkpoint') {
			return true;
		}
		
		return false;
	}

	/**
	 * Extrai arquivos modificados das mensagens de tool
	 */
	private _extractModifiedFiles(messages: ChatMessage[]): string[] {
		const files = new Set<string>();
		
		for (const msg of messages) {
			if (msg.role === 'tool') {
				// Extrair URI de parâmetros de ferramentas de arquivo
				const params = msg.rawParams as Record<string, unknown>;
				if (params?.uri && typeof params.uri === 'string') {
					files.add(params.uri);
				}
			}
		}
		
		return Array.from(files);
	}

	/**
	 * Extrai decisões-chave das mensagens
	 */
	private _extractKeyDecisions(messages: ChatMessage[]): string[] {
		const decisions: string[] = [];
		
		for (const msg of messages) {
			if (msg.role === 'assistant') {
				const content = msg.displayContent || '';
				
				// Procurar padrões de decisão
				const decisionPatterns = [
					/(?:decidi|vou|escolhi|optei por|a melhor abordagem é)[^.!?]*[.!?]/gi,
					/(?:criei|editei|deletei|modifiquei)[^.!?]*[.!?]/gi,
					/(?:o problema era|a solução é|descobri que)[^.!?]*[.!?]/gi,
				];
				
				for (const pattern of decisionPatterns) {
					const matches = content.match(pattern);
					if (matches) {
						decisions.push(...matches.slice(0, 2)); // Max 2 por padrão
					}
				}
			}
		}
		
		// Limitar a 10 decisões mais recentes
		return decisions.slice(-10);
	}

	/**
	 * Gera resumo de mensagens
	 */
	generateSummary(messages: ChatMessage[]): ConversationSummary {
		const filesModified = this._extractModifiedFiles(messages);
		const keyDecisions = this._extractKeyDecisions(messages);
		
		// Construir resumo textual
		const summaryParts: string[] = [];
		
		// Contar tipos de mensagens
		const userMsgCount = messages.filter(m => m.role === 'user').length;
		const assistantMsgCount = messages.filter(m => m.role === 'assistant').length;
		const toolMsgCount = messages.filter(m => m.role === 'tool').length;
		
		summaryParts.push(`[Resumo de ${messages.length} mensagens anteriores]`);
		summaryParts.push(`- ${userMsgCount} mensagens do usuário`);
		summaryParts.push(`- ${assistantMsgCount} respostas da Polli`);
		summaryParts.push(`- ${toolMsgCount} execuções de ferramentas`);
		
		if (filesModified.length > 0) {
			summaryParts.push(`\nArquivos modificados: ${filesModified.slice(0, 5).join(', ')}${filesModified.length > 5 ? ` (+${filesModified.length - 5} mais)` : ''}`);
		}
		
		if (keyDecisions.length > 0) {
			summaryParts.push(`\nDecisões-chave:`);
			keyDecisions.slice(0, 5).forEach((d, i) => {
				summaryParts.push(`  ${i + 1}. ${d.trim().substring(0, 100)}`);
			});
		}
		
		// Adicionar última pergunta do usuário (contexto)
		const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
		if (lastUserMsg && lastUserMsg.role === 'user') {
			const preview = lastUserMsg.content.substring(0, 150);
			summaryParts.push(`\nÚltimo contexto: "${preview}${lastUserMsg.content.length > 150 ? '...' : ''}"`);
		}
		
		return {
			summary: summaryParts.join('\n'),
			messageCount: messages.length,
			timestamp: Date.now(),
			keyDecisions,
			filesModified,
		};
	}

	/**
	 * Comprime uma mensagem individual
	 * (Desabilitada temporariamente - não usada no fluxo atual)
	 */
	// private _compressMessage(message: ChatMessage): ChatMessage {
	// 	if (message.role === 'user') {
	// 		const content = message.content;
	// 		if (content.length > COMPRESSION_CONFIG.MAX_SUMMARY_LENGTH) {
	// 			return {
	// 				...message,
	// 				content: content.substring(0, COMPRESSION_CONFIG.MAX_SUMMARY_LENGTH) + '... [comprimido]',
	// 			};
	// 		}
	// 	}
	// 	
	// 	if (message.role === 'assistant') {
	// 		const content = message.displayContent || '';
	// 		if (content.length > COMPRESSION_CONFIG.MAX_SUMMARY_LENGTH * 2) {
	// 			return {
	// 				...message,
	// 				displayContent: content.substring(0, COMPRESSION_CONFIG.MAX_SUMMARY_LENGTH * 2) + '... [comprimido]',
	// 			};
	// 		}
	// 	}
	// 	
	// 	if (message.role === 'tool') {
	// 		const content = message.content;
	// 		if (content.length > COMPRESSION_CONFIG.MAX_SUMMARY_LENGTH * 3) {
	// 			return {
	// 				...message,
	// 				content: `[Resultado de ${message.name}] ` + content.substring(0, COMPRESSION_CONFIG.MAX_SUMMARY_LENGTH) + '... [comprimido]',
	// 			};
	// 		}
	// 	}
	// 	
	// 	return message;
	// }

	/**
	 * Comprime a conversa se necessário
	 */
	compressConversation(
		messages: ChatMessage[],
		contextWindow: number,
		existingSummary?: ConversationSummary
	): CompressionResult {
		// Se não precisa comprimir, retorna como está
		if (!this.needsCompression(messages, contextWindow)) {
			return {
				messages,
				tokensSaved: 0,
				wasCompressed: false,
			};
		}
		
		const originalTokens = this.estimateTotalTokens(messages);
		const totalMessages = messages.length;
		
		// Separar mensagens críticas e não-críticas
		const criticalMessages: ChatMessage[] = [];
		const compressibleMessages: ChatMessage[] = [];
		
		messages.forEach((msg, index) => {
			if (this._isCriticalMessage(msg, index, totalMessages)) {
				criticalMessages.push(msg);
			} else {
				compressibleMessages.push(msg);
			}
		});
		
		// Gerar resumo das mensagens compressíveis
		const summary = this.generateSummary(compressibleMessages);
		
		// Criar resumo textual (não usamos tipo checkpoint pois não existe no ChatMessage)
		const summaryText = existingSummary 
			? existingSummary.summary + '\n\n---\n\n' + summary.summary
			: summary.summary;
		
		// Criar mensagem de usuário com o resumo (simula checkpoint)
		const summaryMessage: ChatMessage = {
			role: 'user',
			content: `📝 [Resumo Automático]\n\n${summaryText}`,
			displayContent: `📝 [Resumo Automático]\n\n${summaryText}`,
			selections: null,
			state: {
				stagingSelections: [],
				isBeingEdited: false
			},
		};
		
		// Nota: não comprimimos individualmente, apenas mantemos críticas
		// const _compressedMessages = compressibleMessages.map(msg => this._compressMessage(msg));
		
		// Montar resultado: resumo + mensagens críticas para economia máxima
		const resultMessages: ChatMessage[] = [
			summaryMessage,
			...criticalMessages,
		];
		
		const newTokens = this.estimateTotalTokens(resultMessages);
		const tokensSaved = originalTokens - newTokens;
		
		console.log(`[ConversationCompressor] Compressão realizada:`);
		console.log(`  - Mensagens originais: ${messages.length}`);
		console.log(`  - Mensagens após compressão: ${resultMessages.length}`);
		console.log(`  - Tokens originais: ~${originalTokens}`);
		console.log(`  - Tokens após compressão: ~${newTokens}`);
		console.log(`  - Tokens economizados: ~${tokensSaved}`);
		
		return {
			messages: resultMessages,
			summary: summary,
			tokensSaved,
			wasCompressed: true,
		};
	}
}

registerSingleton(IConversationCompressorService, ConversationCompressorService, InstantiationType.Eager);
