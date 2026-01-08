/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IRAGVectorService } from './ragVectorService.js';
import { RAGSettings } from './ragTypes.js';
import { URI } from '../../../../base/common/uri.js';

export const IRAGIndexingService = createDecorator<IRAGIndexingService>('RAGIndexingService');

export interface IRAGIndexingService {
	readonly _serviceBrand: undefined;

	/**
	 * Indexa todos os arquivos do workspace
	 */
	indexWorkspace(workspaceFolders: string[]): Promise<void>;

	/**
	 * Indexa um arquivo específico
	 */
	indexFile(filePath: string): Promise<void>;

	/**
	 * Remove um arquivo do índice
	 */
	removeFile(filePath: string): Promise<void>;

	/**
	 * Verifica se um arquivo deve ser indexado
	 */
	shouldIndexFile(filePath: string, settings: RAGSettings): boolean;

	/**
	 * Retorna estatísticas do índice atual
	 */
	getIndexStats(): { documentCount: number; chunkCount: number };
}

/**
 * Serviço para indexar arquivos do workspace no RAG
 */
export class RAGIndexingService extends Disposable implements IRAGIndexingService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IRAGVectorService private readonly ragVectorService: IRAGVectorService,
	) {
		super();
	}

	async indexWorkspace(workspaceFolders: string[]): Promise<void> {
		this.logService.info(`[RAG] Starting workspace indexing for ${workspaceFolders.length} folders`);

		// Por enquanto, implementação simplificada
		// Em produção, percorrer recursivamente todos os arquivos
		// e indexar apenas os que passarem no filtro shouldIndexFile

		this.logService.info('[RAG] Workspace indexing completed (simplified implementation)');
	}

	async indexFile(filePath: string): Promise<void> {
		try {
			const uri = URI.file(filePath);
			const content = await this.fileService.readFile(uri);
			const text = content.value.toString();
			await this.ragVectorService.indexDocument(filePath, text);
		} catch (error) {
			this.logService.error(`[RAG] Failed to index file ${filePath}: ${error}`);
		}
	}

	async removeFile(filePath: string): Promise<void> {
		await this.ragVectorService.removeDocument(filePath);
	}

	shouldIndexFile(filePath: string, settings: RAGSettings): boolean {
		// Verifica extensão
		const ext = '.' + filePath.split('.').pop()?.toLowerCase();
		if (!settings.indexedExtensions.includes(ext)) {
			return false;
		}

		// Verifica padrões de exclusão
		for (const pattern of settings.excludePatterns) {
			if (filePath.includes(pattern)) {
				return false;
			}
		}

		return true;
	}

	getIndexStats(): { documentCount: number; chunkCount: number } {
		return this.ragVectorService.getIndexStats();
	}
}

registerSingleton(IRAGIndexingService, RAGIndexingService, InstantiationType.Delayed);
