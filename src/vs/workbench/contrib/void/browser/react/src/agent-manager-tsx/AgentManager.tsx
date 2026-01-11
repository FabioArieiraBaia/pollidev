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
	const [searchQuery, setSearchQuery] = useState('');

	// Organizar threads em seções
	const { pinnedThreads, activeThreads, archivedThreads } = useMemo(() => {
		const pinned = [];
		const active = [];
		const archived = [];

		// Converter o objeto allThreads em uma lista ordenada por data de modificação (mais recente primeiro)
		const sortedThreads = Object.values(allThreads)
			.filter((t): t is any => !!t)
			.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

		for (const thread of sortedThreads) {
			// Filtro de busca
			const matchesSearch = thread.messages.some((m: any) => 
				m.displayContent?.toLowerCase().includes(searchQuery.toLowerCase())
			) || (thread.id.toLowerCase().includes(searchQuery.toLowerCase()));
			
			// Usar título customizado se existir, senão usar o primeiro conteúdo de mensagem ou o ID
			const firstUserMsg = thread.messages.find((m: any) => m.role === 'user');
			thread.displayTitle = allMetadata[thread.id]?.customTitle || firstUserMsg?.displayContent || `Agente ${thread.id.slice(0, 4)}`;

			const matchesTitle = thread.displayTitle.toLowerCase().includes(searchQuery.toLowerCase());

			if (searchQuery && !matchesSearch && !matchesTitle) continue;

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
	}, [allThreads, allMetadata, searchQuery]);

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
					group p-2.5 rounded transition-colors cursor-pointer mb-1
					${thread.id === currentThreadId 
						? 'bg-void-bg-3 border border-void-accent-1' 
						: 'bg-void-bg-1 border border-void-border-1 hover:border-void-border-2'}
				`}
			>
				<div className="flex justify-between items-start gap-2">
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm truncate text-void-fg-1 flex items-center gap-1.5">
							{isPinned && <span>📌</span>}
							<span className="truncate">{thread.displayTitle}</span>
							{isRunning && <IconLoading className="size-3 opacity-70" />}
						</div>
						<div className="text-[10px] text-void-fg-3 mt-1 uppercase tracking-wider">
							{formatLastModified(thread.lastModified)}
						</div>
					</div>
					<div className="flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							onClick={(e) => { e.stopPropagation(); isPinned ? unpinThread(thread.id) : pinThread(thread.id); }}
							className="p-1 hover:bg-void-bg-2 rounded text-void-fg-2"
							title={isPinned ? "Desafixar" : "Fixar"}
						>
							{isPinned ? '📍' : '📌'}
						</button>
						<button
							onClick={(e) => { e.stopPropagation(); isArchived ? unarchiveThread(thread.id) : archiveThread(thread.id); }}
							className="p-1 hover:bg-void-bg-2 rounded text-void-fg-2"
							title={isArchived ? "Desarquivar" : "Arquivar"}
						>
							{isArchived ? '📤' : '📥'}
						</button>
						<button
							onClick={(e) => handleDeleteThread(e, thread.id)}
							className="p-1 hover:bg-void-bg-2 rounded text-void-fg-2 hover:text-red-400"
							title="Excluir"
						>
							🗑️
						</button>
					</div>
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
						<div className="p-4 border-b border-void-border-1">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-sm font-bold uppercase tracking-widest text-void-fg-1">Agentes</h2>
								<button
									onClick={handleNewAgent}
									className="px-2 py-1 bg-void-accent-1 hover:bg-opacity-80 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
								>
									<span>+</span> Novo Agente
								</button>
							</div>
							<div className="relative">
								<input
									type="text"
									placeholder="Buscar conversas..."
									className="w-full bg-void-bg-1 border border-void-border-1 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-void-accent-1 text-void-fg-1"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
							{pinnedThreads.length > 0 && (
								<div className="mb-6">
									<h3 className="text-[10px] font-bold text-void-fg-3 uppercase tracking-widest mb-2 px-1">Fixados</h3>
									{pinnedThreads.map(thread => (
										<ThreadItem key={thread.id} thread={thread} isPinned />
									))}
								</div>
							)}

							<div className="mb-6">
								<h3 className="text-[10px] font-bold text-void-fg-3 uppercase tracking-widest mb-2 px-1">Conversas Ativas</h3>
								{activeThreads.length > 0 ? (
									activeThreads.map(thread => (
										<ThreadItem key={thread.id} thread={thread} />
									))
								) : (
									<div className="text-xs text-void-fg-3 px-1 italic">Nenhuma conversa ativa</div>
								)}
							</div>

							{archivedThreads.length > 0 && (
								<div className="mb-4 opacity-70 hover:opacity-100 transition-opacity">
									<h3 className="text-[10px] font-bold text-void-fg-3 uppercase tracking-widest mb-2 px-1">Arquivados</h3>
									{archivedThreads.map(thread => (
										<ThreadItem key={thread.id} thread={thread} isArchived />
									))}
								</div>
							)}
						</div>
					</div>
				</ErrorBoundary>
			</div>
		</div>
	);
};

