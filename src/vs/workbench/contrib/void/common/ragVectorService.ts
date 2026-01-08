/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { DocumentChunk, VectorSearchResult } from './ragTypes.js';
import { generateUuid } from '../../../../base/common/uuid.js';
// Função auxiliar para calcular similaridade de cosseno
function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		return 0;
	}
	let dotProduct = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denominator = Math.sqrt(normA) * Math.sqrt(normB);
	if (denominator === 0) return 0;
	return dotProduct / denominator;
}

export const IRAGVectorService = createDecorator<IRAGVectorService>('RAGVectorService');

export interface IRAGVectorService {
	readonly _serviceBrand: undefined;

	/**
	 * Indexa um documento (arquivo) no vector database
	 */
	indexDocument(filePath: string, content: string): Promise<void>;

	/**
	 * Remove um documento do índice
	 */
	removeDocument(filePath: string): Promise<void>;

	/**
	 * Busca documentos similares a uma query
	 */
	search(query: string, maxResults?: number): Promise<VectorSearchResult[]>;

	/**
	 * Gera embedding para um texto
	 */
	generateEmbedding(text: string): Promise<number[]>;

	/**
	 * Limpa todo o índice
	 */
	clearIndex(): Promise<void>;

	/**
	 * Retorna estatísticas do índice
	 */
	getIndexStats(): { documentCount: number; chunkCount: number };
}

/**
 * Serviço de Vector Database in-memory para RAG
 * Armazena embeddings e permite busca por similaridade
 */
export class RAGVectorService extends Disposable implements IRAGVectorService {
	declare readonly _serviceBrand: undefined;

	private readonly _chunks = new Map<string, DocumentChunk>();
	private readonly _documentChunks = new Map<string, string[]>(); // filePath -> chunkIds[]

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async generateEmbedding(text: string): Promise<number[]> {
		// TODO: Implementar geração de embeddings usando API
		// Por enquanto, retorna um embedding dummy baseado em hash simples
		// Para produção, usar API de embeddings (OpenAI, Cohere, ou local)
		
		this.logService.info(`[RAG] Generating embedding for text of length ${text.length}`);
		
		// Embedding dummy: vetor de dimensão 384 (dimensão comum)
		// Em produção, substituir por chamada real à API de embeddings
		const dimension = 384;
		const embedding = new Array(dimension).fill(0).map((_, i) => {
			// Simulação baseada em hash do texto
			const hash = this._simpleHash(text + i);
			return (hash % 200 - 100) / 100; // Normalizar entre -1 e 1
		});

		return embedding;
	}

	private _simpleHash(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash);
	}

	async indexDocument(filePath: string, content: string): Promise<void> {
		this.logService.info(`[RAG] Indexing document: ${filePath}`);

		// Remove chunks antigos deste documento
		await this.removeDocument(filePath);

		// Divide o conteúdo em chunks
		const chunks = this._splitIntoChunks(content, 1000, 200);

		// Gera embeddings e indexa cada chunk
		const chunkIds: string[] = [];
		for (const chunk of chunks) {
			const chunkId = generateUuid();
			const embedding = await this.generateEmbedding(chunk);

			const documentChunk: DocumentChunk = {
				id: chunkId,
				filePath,
				content: chunk,
				embedding,
				metadata: {
					fileName: filePath.split(/[/\\]/).pop() || filePath,
					fileType: this._getFileType(filePath),
				},
			};

			this._chunks.set(chunkId, documentChunk);
			chunkIds.push(chunkId);
		}

		this._documentChunks.set(filePath, chunkIds);
		this.logService.info(`[RAG] Indexed ${chunks.length} chunks for ${filePath}`);
	}

	async removeDocument(filePath: string): Promise<void> {
		const chunkIds = this._documentChunks.get(filePath);
		if (chunkIds) {
			for (const chunkId of chunkIds) {
				this._chunks.delete(chunkId);
			}
			this._documentChunks.delete(filePath);
			this.logService.info(`[RAG] Removed document: ${filePath}`);
		}
	}

	async search(query: string, maxResults: number = 5): Promise<VectorSearchResult[]> {
		this.logService.info(`[RAG] Searching for: ${query.substring(0, 50)}...`);

		// Gera embedding da query
		const queryEmbedding = await this.generateEmbedding(query);

		// Calcula similaridade com todos os chunks
		const results: VectorSearchResult[] = [];
		for (const chunk of this._chunks.values()) {
			if (!chunk.embedding) continue;

			const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
			if (similarity > 0.5) { // Threshold mínimo
				results.push({
					chunk,
					similarity,
				});
			}
		}

		// Ordena por similaridade (maior primeiro)
		results.sort((a, b) => b.similarity - a.similarity);

		// Retorna top N resultados
		return results.slice(0, maxResults);
	}

	async clearIndex(): Promise<void> {
		this._chunks.clear();
		this._documentChunks.clear();
		this.logService.info('[RAG] Index cleared');
	}

	getIndexStats(): { documentCount: number; chunkCount: number } {
		return {
			documentCount: this._documentChunks.size,
			chunkCount: this._chunks.size,
		};
	}

	private _splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
		const chunks: string[] = [];
		let start = 0;

		while (start < text.length) {
			const end = Math.min(start + chunkSize, text.length);
			const chunk = text.substring(start, end);
			chunks.push(chunk);

			if (end >= text.length) break;
			start = end - overlap;
		}

		return chunks;
	}

	private _getFileType(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase() || '';
		return ext;
	}
}

registerSingleton(IRAGVectorService, RAGVectorService, InstantiationType.Delayed);
