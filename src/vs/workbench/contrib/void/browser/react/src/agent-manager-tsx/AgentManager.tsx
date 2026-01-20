import React, { useMemo, useState, useCallback } from 'react';
import { useIsDark, useThreadMetadataState, useChatThreadsState, useAccessor, useFullChatThreadsStreamState } from '../util/services.js';
import { IconLoading } from '../sidebar-tsx/SidebarChat.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import '../styles.css';

export const AgentManager = () => {
	const isDark = useIsDark();
	const accessor = useAccessor();
	const chatThreadService = accessor.get('IChatThreadService');

	const { allThreads, currentThreadId } = useChatThreadsState();
	const { allMetadata, pinThread, unpinThread, archiveThread, unarchiveThread } = useThreadMetadataState();
	const streamStates = useFullChatThreadsStreamState();

	// Organizar threads em seções
	const { pinnedThreads, activeThreads, archivedThreads } = useMemo(() => {
		const pinned = [];
		const active = [];
		const archived = [];

		const sortedThreads = Object.values(allThreads)
			.filter((t): t is any => !!t)
			.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

		for (const thread of sortedThreads) {
			const firstUserMsg = thread.messages.find((m: any) => m.role === 'user');
			thread.displayTitle = allMetadata[thread.id]?.customTitle || firstUserMsg?.displayContent || `Agente ${thread.id.slice(0, 4)}`;

			const metadata = allMetadata[thread.id];
			if (metadata?.isPinned) {
				pinned.push(thread);
			} else if (metadata?.isArchived) {
				archived.push(thread);
			} else {
				active.push(thread);
			}
		}

		return { pinnedThreads: pinned, activeThreads: active, archivedThreads: archived };
	}, [allThreads, allMetadata]);

	const handleNewAgent = useCallback(() => {
		chatThreadService.openNewThread();
	}, [chatThreadService]);

	const handleSwitchThread = useCallback((threadId: string) => {
		chatThreadService.switchToThread(threadId);
	}, [chatThreadService]);

	const handleDeleteThread = useCallback((e: React.MouseEvent, threadId: string) => {
		e.stopPropagation();
		chatThreadService.deleteThread(threadId);
	}, [chatThreadService]);

	const formatLastModified = (isoString: string) => {
		const date = new Date(isoString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Agora mesmo';
		if (diffMins < 60) return `${diffMins}m atrás`;
		if (diffHours < 24) return `${diffHours}h atrás`;
		if (diffDays === 1) return 'Ontem';
		return date.toLocaleDateString();
	};

	const ThreadItem = ({ thread, isPinned, isArchived }: { thread: any, isPinned?: boolean, isArchived?: boolean }) => {
		const streamState = streamStates[thread.id];
		const isRunning = streamState?.isRunning && streamState.isRunning !== 'awaiting_user';

		return (
			<div
				onClick={() => handleSwitchThread(thread.id)}
				className={`
					group flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer
					${thread.id === currentThreadId 
						? 'bg-void-bg-3/50' 
						: 'hover:bg-void-bg-2/50'}
				`}
			>
				<span className="text-xs opacity-50">
					{isArchived ? '📤' : isPinned ? '📌' : '•'}
				</span>
				<span className={`
					flex-1 text-xs truncate
					${isRunning ? 'text-void-accent-1 drop-shadow-[0_0_8px_rgba(0,127,212,0.8)]' : ''}
					${isArchived ? 'opacity-50' : ''}
				`}>
					{thread.displayTitle}
				</span>
				{isRunning && <IconLoading className="size-3 opacity-70" />}
				<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						onClick={(e) => { e.stopPropagation(); isPinned ? unpinThread(thread.id) : pinThread(thread.id); }}
						className="p-0.5 hover:bg-void-bg-3 rounded text-void-fg-2 text-xs"
						title={isPinned ? "Desafixar" : "Fixar"}
					>
						{isPinned ? '📍' : '📌'}
					</button>
					<button
						onClick={(e) => { e.stopPropagation(); isArchived ? unarchiveThread(thread.id) : archiveThread(thread.id); }}
						className="p-0.5 hover:bg-void-bg-3 rounded text-void-fg-2 text-xs"
						title={isArchived ? "Desarquivar" : "Arquivar"}
					>
						{isArchived ? '📤' : '📥'}
					</button>
					<button
						onClick={(e) => handleDeleteThread(e, thread.id)}
						className="p-0.5 hover:bg-void-bg-3 rounded text-void-fg-2 hover:text-red-400 text-xs"
						title="Excluir"
					>
						🗑️
					</button>
				</div>
			</div>
		);
	};

	return (
		<div
			className={`@@void-scope ${isDark ? 'dark' : ''}`}
			style={{ width: '100%', height: '100%' }}
		>
			<div className="w-full h-full bg-void-bg-2 text-void-fg-1 flex flex-col">
				<ErrorBoundary>
					<div className="flex flex-col h-full">
						{/* Header */}
						<div className="p-3 border-b border-void-border-1/30">
							<div className="flex items-center justify-end">
								<button
									onClick={handleNewAgent}
									className="group px-3 py-1 bg-void-accent-1/20 hover:bg-void-accent-1/40 border border-void-accent-1/30 hover:border-void-accent-1/60 rounded text-xs text-void-accent-1 transition-all flex items-center gap-1.5 glass-button"
								>
									<span className="group-hover:scale-110 transition-transform text-void-accent-1">+</span>
									<span className="font-medium text-void-accent-1">Novo</span>
								</button>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
							{pinnedThreads.length > 0 && (
								<div className="mb-4">
									<div className="flex items-center gap-2 mb-2 px-1">
										<span className="w-1.5 h-1.5 rounded-full bg-void-accent-1/70"></span>
										<span className="text-[10px] font-medium text-void-fg-3/70 uppercase tracking-wider">Fixados</span>
										<span className="text-[10px] text-void-fg-3/40">{pinnedThreads.length}</span>
									</div>
									<div className="flex flex-col gap-0.5">
										{pinnedThreads.map(thread => (
											<ThreadItem key={thread.id} thread={thread} isPinned />
										))}
									</div>
								</div>
							)}

							<div className="mb-4">
								<div className="flex items-center gap-2 mb-2 px-1">
									<span className="w-1.5 h-1.5 rounded-full bg-void-fg-2/50"></span>
									<span className="text-[10px] font-medium text-void-fg-3/70 uppercase tracking-wider">Ativos</span>
									<span className="text-[10px] text-void-fg-3/40">{activeThreads.length}</span>
								</div>
								{activeThreads.length > 0 ? (
									<div className="flex flex-col gap-0.5">
										{activeThreads.map(thread => (
											<ThreadItem key={thread.id} thread={thread} />
										))}
									</div>
								) : (
									<div className="text-[10px] text-void-fg-3/40 px-3 italic">Nenhum agente ativo</div>
								)}
							</div>

							{archivedThreads.length > 0 && (
								<div className="mb-4 opacity-60 hover:opacity-100 transition-opacity">
									<div className="flex items-center gap-2 mb-2 px-1">
										<span className="w-1.5 h-1.5 rounded-full bg-void-fg-3/30"></span>
										<span className="text-[10px] font-medium text-void-fg-3/50 uppercase tracking-wider">Arquivados</span>
										<span className="text-[10px] text-void-fg-3/30">{archivedThreads.length}</span>
									</div>
									<div className="flex flex-col gap-0.5">
										{archivedThreads.map(thread => (
											<ThreadItem key={thread.id} thread={thread} isArchived />
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</ErrorBoundary>
			</div>
		</div>
	);
};