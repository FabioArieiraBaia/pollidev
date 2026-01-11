/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { THREAD_METADATA_STORAGE_KEY } from '../common/storageKeys.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

export interface ThreadMetadata {
	isPinned?: boolean;
	isArchived?: boolean;
	customTitle?: string;
}

export type ThreadMetadataMap = { [threadId: string]: ThreadMetadata };

export const IThreadMetadataService = createDecorator<IThreadMetadataService>('threadMetadataService');

export interface IThreadMetadataService {
	readonly _serviceBrand: undefined;
	onDidChangeMetadata: import('../../../../base/common/event.js').Event<void>;
	getMetadata(threadId: string): ThreadMetadata;
	getAllMetadata(): ThreadMetadataMap;
	setMetadata(threadId: string, metadata: ThreadMetadata): void;
	deleteMetadata(threadId: string): void;
	pinThread(threadId: string): void;
	unpinThread(threadId: string): void;
	archiveThread(threadId: string): void;
	unarchiveThread(threadId: string): void;
	setCustomTitle(threadId: string, title: string): void;
	isPinned(threadId: string): boolean;
	isArchived(threadId: string): boolean;
}

export class ThreadMetadataService extends Disposable implements IThreadMetadataService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeMetadata = this._register(new Emitter<void>());
	readonly onDidChangeMetadata = this._onDidChangeMetadata.event;

	private metadata: ThreadMetadataMap = {};

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
		this.loadMetadata();
	}

	private loadMetadata(): void {
		const raw = this.storageService.get(THREAD_METADATA_STORAGE_KEY, StorageScope.APPLICATION);
		if (raw) {
			try {
				this.metadata = JSON.parse(raw);
			} catch (e) {
				console.error('Error loading thread metadata', e);
				this.metadata = {};
			}
		}
	}

	private saveMetadata(): void {
		this.storageService.store(THREAD_METADATA_STORAGE_KEY, JSON.stringify(this.metadata), StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChangeMetadata.fire();
	}

	getMetadata(threadId: string): ThreadMetadata {
		return this.metadata[threadId] || {};
	}

	getAllMetadata(): ThreadMetadataMap {
		return this.metadata;
	}

	setMetadata(threadId: string, metadata: ThreadMetadata): void {
		this.metadata[threadId] = { ...this.getMetadata(threadId), ...metadata };
		this.saveMetadata();
	}

	deleteMetadata(threadId: string): void {
		delete this.metadata[threadId];
		this.saveMetadata();
	}

	pinThread(threadId: string): void {
		this.setMetadata(threadId, { isPinned: true });
	}

	unpinThread(threadId: string): void {
		this.setMetadata(threadId, { isPinned: false });
	}

	archiveThread(threadId: string): void {
		this.setMetadata(threadId, { isArchived: true, isPinned: false });
	}

	unarchiveThread(threadId: string): void {
		this.setMetadata(threadId, { isArchived: false });
	}

	setCustomTitle(threadId: string, title: string): void {
		this.setMetadata(threadId, { customTitle: title });
	}

	isPinned(threadId: string): boolean {
		return !!this.getMetadata(threadId).isPinned;
	}

	isArchived(threadId: string): boolean {
		return !!this.getMetadata(threadId).isArchived;
	}
}

registerSingleton(IThreadMetadataService, ThreadMetadataService, 1);




