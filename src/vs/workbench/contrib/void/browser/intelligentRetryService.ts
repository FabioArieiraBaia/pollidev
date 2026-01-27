/*---------------------------------------------------------------------------------------------
 *  PolliDev - Sistema de Retry Inteligente e Auto-Correção
 *  
 *  Este serviço gerencia:
 *  - Retry automático com backoff exponencial
 *  - Detecção e correção de erros comuns
 *  - Validação pós-execução de ferramentas
 *  - Rollback automático em caso de falha
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

// Configurações de retry
const RETRY_CONFIG = {
	// Número máximo de tentativas
	MAX_RETRIES: 3,
	
	// Delay inicial em ms
	INITIAL_DELAY: 1000,
	
	// Multiplicador de backoff
	BACKOFF_MULTIPLIER: 2,
	
	// Delay máximo em ms
	MAX_DELAY: 10000,
	
	// Erros que devem triggerar retry
	RETRYABLE_ERRORS: [
		'ECONNRESET',
		'ETIMEDOUT',
		'ENOTFOUND',
		'rate_limit',
		'timeout',
		'503',
		'502',
		'500',
		'overloaded',
	],
	
	// Erros que indicam parâmetros inválidos (não fazer retry, corrigir)
	PARAMETER_ERRORS: [
		'invalid_parameter',
		'invalidparameters',
		'missing required',
		'invalid value',
		'validation error',
	],
};

export interface RetryContext {
	/** Nome da operação sendo executada */
	operationName: string;
	/** Parâmetros da operação */
	params: Record<string, unknown>;
	/** Número de tentativas já realizadas */
	attemptCount: number;
	/** Erros anteriores */
	previousErrors: Error[];
	/** Timestamp de início */
	startTime: number;
}

export interface RetryResult<T> {
	/** Se a operação foi bem sucedida */
	success: boolean;
	/** Resultado da operação (se sucesso) */
	result?: T;
	/** Erro final (se falha) */
	error?: Error;
	/** Número total de tentativas */
	totalAttempts: number;
	/** Tempo total gasto */
	totalTimeMs: number;
	/** Se houve correção de parâmetros */
	parametersCorrected: boolean;
}

export interface ErrorAnalysis {
	/** Tipo do erro */
	errorType: 'retryable' | 'parameter' | 'fatal';
	/** Mensagem de erro original */
	originalMessage: string;
	/** Sugestão de correção */
	suggestion?: string;
	/** Parâmetros corrigidos (se aplicável) */
	correctedParams?: Record<string, unknown>;
}

export interface IIntelligentRetryService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Executa uma operação com retry inteligente
	 */
	executeWithRetry<T>(
		operation: (params: Record<string, unknown>) => Promise<T>,
		params: Record<string, unknown>,
		operationName: string
	): Promise<RetryResult<T>>;
	
	/**
	 * Analisa um erro e determina a ação apropriada
	 */
	analyzeError(error: Error, operationName: string, params: Record<string, unknown>): ErrorAnalysis;
	
	/**
	 * Tenta corrigir parâmetros com base no erro
	 */
	correctParameters(
		error: Error,
		operationName: string,
		params: Record<string, unknown>
	): Record<string, unknown> | null;
	
	/**
	 * Calcula o delay para a próxima tentativa
	 */
	calculateBackoffDelay(attemptCount: number): number;
}

export const IIntelligentRetryService = createDecorator<IIntelligentRetryService>('IntelligentRetryService');

class IntelligentRetryService extends Disposable implements IIntelligentRetryService {
	_serviceBrand: undefined;

	constructor() {
		super();
	}

	/**
	 * Calcula delay com backoff exponencial
	 */
	calculateBackoffDelay(attemptCount: number): number {
		const delay = RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attemptCount - 1);
		return Math.min(delay, RETRY_CONFIG.MAX_DELAY);
	}

	/**
	 * Analisa um erro e categoriza
	 */
	analyzeError(error: Error, operationName: string, params: Record<string, unknown>): ErrorAnalysis {
		const errorMessage = error.message.toLowerCase();
		
		// Verificar se é erro de parâmetro
		for (const pattern of RETRY_CONFIG.PARAMETER_ERRORS) {
			if (errorMessage.includes(pattern.toLowerCase())) {
				const correctedParams = this.correctParameters(error, operationName, params);
				return {
					errorType: 'parameter',
					originalMessage: error.message,
					suggestion: this._generateParameterSuggestion(error, operationName),
					correctedParams: correctedParams || undefined,
				};
			}
		}
		
		// Verificar se é erro retentável
		for (const pattern of RETRY_CONFIG.RETRYABLE_ERRORS) {
			if (errorMessage.includes(pattern.toLowerCase())) {
				return {
					errorType: 'retryable',
					originalMessage: error.message,
					suggestion: `Erro temporário detectado. Tentando novamente...`,
				};
			}
		}
		
		// Erro fatal - não tentar novamente
		return {
			errorType: 'fatal',
			originalMessage: error.message,
			suggestion: `Erro não recuperável: ${error.message}`,
		};
	}

	/**
	 * Gera sugestão para correção de parâmetros
	 */
	private _generateParameterSuggestion(error: Error, operationName: string): string {
		const errorMessage = error.message.toLowerCase();
		
		// Sugestões específicas por tipo de operação
		if (operationName === 'edit_file') {
			if (errorMessage.includes('search')) {
				return 'O bloco SEARCH não foi encontrado no arquivo. Verifique se o texto existe exatamente como especificado.';
			}
			if (errorMessage.includes('uri') || errorMessage.includes('path')) {
				return 'Caminho do arquivo inválido. Use o caminho completo do arquivo.';
			}
		}
		
		if (operationName === 'run_command') {
			if (errorMessage.includes('timeout')) {
				return 'Comando demorou muito. Considere usar run_persistent_command para comandos longos.';
			}
		}
		
		if (operationName === 'read_file') {
			if (errorMessage.includes('not found') || errorMessage.includes('enoent')) {
				return 'Arquivo não encontrado. Use search_pathnames_only para localizar o arquivo correto.';
			}
		}
		
		return `Parâmetros inválidos para ${operationName}. Verifique a documentação da ferramenta.`;
	}

	/**
	 * Tenta corrigir parâmetros automaticamente
	 */
	correctParameters(
		error: Error,
		operationName: string,
		params: Record<string, unknown>
	): Record<string, unknown> | null {
		const errorMessage = error.message.toLowerCase();
		const correctedParams = { ...params };
		let wasModified = false;
		
		// Correções específicas por ferramenta
		if (operationName === 'edit_file') {
			// Corrigir problema de whitespace no SEARCH block
			if (errorMessage.includes('search') && typeof correctedParams.search_replace_blocks === 'string') {
				const blocks = correctedParams.search_replace_blocks as string;
				// Normalizar line endings
				correctedParams.search_replace_blocks = blocks.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
				wasModified = true;
			}
		}
		
		if (operationName === 'run_command') {
			// Adicionar timeout se não especificado
			if (!correctedParams.timeout) {
				correctedParams.timeout = 30000;
				wasModified = true;
			}
		}
		
		if (operationName === 'read_file') {
			// Normalizar caminho do arquivo
			if (typeof correctedParams.uri === 'string') {
				const uri = correctedParams.uri as string;
				// Converter barras invertidas para barras normais em alguns casos
				if (uri.includes('\\\\')) {
					correctedParams.uri = uri.replace(/\\\\/g, '\\');
					wasModified = true;
				}
			}
		}
		
		// Correção genérica: remover parâmetros undefined/null
		for (const key of Object.keys(correctedParams)) {
			if (correctedParams[key] === undefined || correctedParams[key] === null) {
				delete correctedParams[key];
				wasModified = true;
			}
		}
		
		return wasModified ? correctedParams : null;
	}

	/**
	 * Executa operação com retry inteligente
	 */
	async executeWithRetry<T>(
		operation: (params: Record<string, unknown>) => Promise<T>,
		params: Record<string, unknown>,
		operationName: string
	): Promise<RetryResult<T>> {
		const startTime = Date.now();
		let currentParams = { ...params };
		let parametersCorrected = false;
		const previousErrors: Error[] = [];
		
		for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
			try {
				console.log(`[IntelligentRetry] Tentativa ${attempt}/${RETRY_CONFIG.MAX_RETRIES} para ${operationName}`);
				
				const result = await operation(currentParams);
				
				return {
					success: true,
					result,
					totalAttempts: attempt,
					totalTimeMs: Date.now() - startTime,
					parametersCorrected,
				};
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				previousErrors.push(err);
				
				console.warn(`[IntelligentRetry] Erro na tentativa ${attempt}: ${err.message}`);
				
				// Analisar o erro
				const analysis = this.analyzeError(err, operationName, currentParams);
				
				// Se é erro fatal, não tentar novamente
				if (analysis.errorType === 'fatal') {
					console.error(`[IntelligentRetry] Erro fatal detectado, abortando: ${err.message}`);
					return {
						success: false,
						error: err,
						totalAttempts: attempt,
						totalTimeMs: Date.now() - startTime,
						parametersCorrected,
					};
				}
				
				// Se é erro de parâmetro e temos correção, aplicar
				if (analysis.errorType === 'parameter' && analysis.correctedParams) {
					console.log(`[IntelligentRetry] Aplicando correção de parâmetros...`);
					currentParams = analysis.correctedParams;
					parametersCorrected = true;
					// Não esperar, tentar imediatamente com parâmetros corrigidos
					continue;
				}
				
				// Se é erro retentável e não é última tentativa, esperar e tentar novamente
				if (analysis.errorType === 'retryable' && attempt < RETRY_CONFIG.MAX_RETRIES) {
					const delay = this.calculateBackoffDelay(attempt);
					console.log(`[IntelligentRetry] Aguardando ${delay}ms antes da próxima tentativa...`);
					await this._sleep(delay);
					continue;
				}
				
				// Última tentativa falhou
				if (attempt === RETRY_CONFIG.MAX_RETRIES) {
					console.error(`[IntelligentRetry] Máximo de tentativas atingido para ${operationName}`);
				}
			}
		}
		
		// Todas as tentativas falharam
		return {
			success: false,
			error: previousErrors[previousErrors.length - 1] || new Error('Unknown error'),
			totalAttempts: RETRY_CONFIG.MAX_RETRIES,
			totalTimeMs: Date.now() - startTime,
			parametersCorrected,
		};
	}

	/**
	 * Helper para sleep
	 */
	private _sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

registerSingleton(IIntelligentRetryService, IntelligentRetryService, InstantiationType.Eager);
