import React, { useMemo, useState } from 'react';
import { useIsDark, useThreadMetadataState } from '../util/services';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary';
import '../styles.css';

export const AgentManager = () => {
	const isDark = useIsDark();
	const { allMetadata, setMetadata, deleteMetadata, pinThread, unpinThread, archiveThread, unarchiveThread } = useThreadMetadataState();
	const [searchQuery, setSearchQuery] = useState('');

	// Mock de threads para visualização inicial (será substituído pelo serviço real de threads)
	const threads = useMemo(() => {
		return [
			{ id: '1', title: 'Refatoração de Estilos', lastUpdated: '2 mins atrás' },
			{ id: '2', title: 'Implementação de Auth', lastUpdated: '1 hora atrás' },
		];
	}, []);

	const filteredThreads = threads.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

	return (
		<div
			className={`void-scope ${isDark ? 'void-dark' : ''}`}
			style={{ width: '100%', height: '100%' }}
		>
			<div
				className={`
					w-full h-full
					bg-void-bg-2
					text-void-fg-1
					flex flex-col
				`}
			>
				<div className={`w-full h-full`}>
					<ErrorBoundary>
						<div className="flex flex-col h-full">
							<div className="p-4 border-b border-void-border-1">
								<h2 className="text-lg font-bold mb-4">Gerenciador de Agentes</h2>
								<div className="relative">
									<input
										type="text"
										placeholder="Buscar threads..."
										className="w-full bg-void-bg-1 border border-void-border-1 rounded px-3 py-2 text-sm focus:outline-none focus:border-void-accent-1 text-void-fg-1"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
									/>
								</div>
							</div>

							<div className="flex-1 overflow-y-auto p-4">
								<div className="space-y-2">
									{filteredThreads.map(thread => (
										<div
											key={thread.id}
											className="group p-3 rounded bg-void-bg-1 border border-void-border-1 hover:border-void-accent-1 transition-colors cursor-pointer"
										>
											<div className="flex justify-between items-start">
												<div>
													<div className="font-medium text-sm">{thread.title}</div>
													<div className="text-xs text-void-fg-3 mt-1">{thread.lastUpdated}</div>
												</div>
												<div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														onClick={(e) => { e.stopPropagation(); pinThread(thread.id); }}
														className="p-1 hover:bg-void-bg-2 rounded"
														title="Fixar"
													>
														📍
													</button>
													<button
														onClick={(e) => { e.stopPropagation(); archiveThread(thread.id); }}
														className="p-1 hover:bg-void-bg-2 rounded"
														title="Arquivar"
													>
														📥
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</ErrorBoundary>
				</div>
			</div>
		</div>
	);
};

