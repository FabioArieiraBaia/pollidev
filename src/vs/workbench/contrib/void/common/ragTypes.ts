/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Tipos e interfaces para o sistema RAG (Retrieval Augmented Generation)
 */

export interface DocumentChunk {
	id: string
	filePath: string
	content: string
	startLine?: number
	endLine?: number
	embedding?: number[]
	metadata?: {
		fileName: string
		fileType: string
		lastModified?: number
		language?: string
	}
}

export interface VectorSearchResult {
	chunk: DocumentChunk
	similarity: number // 0-1
}

export interface RAGSettings {
	enabled: boolean
	embeddingModel: string // Modelo para gerar embeddings (ex: 'openai-fast' ou API externa)
	chunkSize: number // Tamanho máximo de cada chunk em caracteres
	chunkOverlap: number // Sobreposição entre chunks
	maxResults: number // Número máximo de resultados para busca
	similarityThreshold: number // Threshold mínimo de similaridade (0-1)
	autoIndex: boolean // Indexar automaticamente arquivos modificados
	indexedExtensions: string[] // Extensões de arquivo para indexar (ex: ['.ts', '.js', '.md'])
	excludePatterns: string[] // Padrões a excluir (ex: ['node_modules', '.git'])
}

export const defaultRAGSettings: RAGSettings = {
	enabled: false,
	embeddingModel: 'openai-fast', // Usar modelo rápido para embeddings
	chunkSize: 1000,
	chunkOverlap: 200,
	maxResults: 5,
	similarityThreshold: 0.7,
	autoIndex: true,
	indexedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml'],
	excludePatterns: ['node_modules', '.git', 'dist', 'build', '.next', '.cache'],
}
