/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { X, Globe, MousePointer, Type, Camera, Maximize2, Move, ArrowLeft, ArrowRight, RefreshCw, User, Bot } from 'lucide-react';
import { useAccessor } from '../util/services.js';
import { ISharedBrowserService, SharedBrowserState, BrowserAction } from '../../../../common/sharedBrowserService.js';

const actionIcons: Record<string, React.ReactNode> = {
	navigate: <Globe className="h-4 w-4" />,
	click: <MousePointer className="h-4 w-4" />,
	type: <Type className="h-4 w-4" />,
	snapshot: <Camera className="h-4 w-4" />,
	screenshot: <Camera className="h-4 w-4" />,
	hover: <Move className="h-4 w-4" />,
	scroll: <Maximize2 className="h-4 w-4" />,
};

export const SharedBrowserView = () => {
	const accessor = useAccessor();
	const sharedBrowserService = accessor.get('ISharedBrowserService') as ISharedBrowserService;
	const [browserState, setBrowserState] = useState<SharedBrowserState>(sharedBrowserService.state);
	const [urlInput, setUrlInput] = useState<string>(browserState.currentUrl || '');

	useEffect(() => {
		setBrowserState(sharedBrowserService.state);
		setUrlInput(sharedBrowserService.state.currentUrl || '');
		const disposable = sharedBrowserService.onDidUpdateState(() => {
			setBrowserState(sharedBrowserService.state);
			setUrlInput(sharedBrowserService.state.currentUrl || '');
		});
		return () => disposable.dispose();
	}, [sharedBrowserService]);

	if (!browserState.isActive) {
		return null;
	}

	const handleNavigate = async () => {
		if (!urlInput.trim()) return;
		
		// Ensure user control mode before navigation
		if (browserState.controlMode !== 'user') {
			await sharedBrowserService.assumeUserControl();
			// Wait for state to update - poll until control mode changes
			let attempts = 0;
			while (sharedBrowserService.state.controlMode !== 'user' && attempts < 10) {
				await new Promise(resolve => setTimeout(resolve, 100));
				attempts++;
			}
			
			// If still not in user mode, log error
			if (sharedBrowserService.state.controlMode !== 'user') {
				console.error('[SharedBrowserView] Failed to assume user control');
				return;
			}
		}
		
		// Ensure URL has protocol
		let url = urlInput.trim();
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			url = 'https://' + url;
		}
		
		try {
			await sharedBrowserService.executeUserAction({
				type: 'navigate',
				url: url,
				timestamp: Date.now(),
				description: `Navigate to ${url}`,
			});
			
			// Update input with normalized URL
			setUrlInput(url);
		} catch (error) {
			console.error('[SharedBrowserView] Navigation error:', error);
		}
	};

	const handleControlToggle = () => {
		if (browserState.controlMode === 'agent') {
			sharedBrowserService.assumeUserControl();
		} else {
			sharedBrowserService.returnToAgentControl();
		}
	};

	const formatTimestamp = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString();
	};

	const getActionIcon = (actionType: string) => {
		return actionIcons[actionType] || <Maximize2 className="h-4 w-4" />;
	};

	return (
		<div className="shared-browser-view flex flex-col border-t border-[var(--void-border-4)] bg-[var(--void-bg-2)]" style={{ position: 'relative' }}>
			{/* Header */}
			<div className="browser-header flex items-center justify-between px-4 py-2 border-b border-[var(--void-border-4)] bg-[var(--void-bg-2)]" style={{ position: 'relative', zIndex: 10 }}>
				<div className="flex items-center gap-2">
					<Globe className="h-5 w-5 text-[var(--void-fg-1)]" />
					<span className="text-[var(--void-fg-1)] font-semibold">Shared Browser</span>
					{/* Control Mode Indicator */}
					<div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
						browserState.controlMode === 'agent' 
							? 'bg-blue-500/20 text-blue-400' 
							: 'bg-green-500/20 text-green-400'
					}`}>
						{browserState.controlMode === 'agent' ? (
							<>
								<Bot className="h-3 w-3" />
								<span>Agent Control</span>
							</>
						) : (
							<>
								<User className="h-3 w-3" />
								<span>User Control</span>
							</>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					{/* Control Toggle Button */}
					<button
						onClick={handleControlToggle}
						className="px-3 py-1 rounded text-xs bg-[var(--void-bg-1)] hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors border border-[var(--void-border-4)]"
						title={browserState.controlMode === 'agent' ? 'Assume Control' : 'Return to Agent'}
					>
						{browserState.controlMode === 'agent' ? (
							<>
								<User className="h-3 w-3 inline mr-1" />
								Assume Control
							</>
						) : (
							<>
								<Bot className="h-3 w-3 inline mr-1" />
								Return to Agent
							</>
						)}
					</button>
					<button
						onClick={() => sharedBrowserService.close()}
						className="p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors"
						title="Close browser view"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* URL Bar with Navigation Controls */}
			<div className="browser-url-bar px-4 py-2 bg-[var(--void-bg-1)] border-b border-[var(--void-border-4)]" style={{ position: 'relative', zIndex: 10 }}>
				<div className="flex items-center gap-2">
					{/* Navigation Controls */}
					<div className="flex items-center gap-1">
						<button
							onClick={async () => {
								if (browserState.controlMode !== 'user') {
									await sharedBrowserService.assumeUserControl();
								}
								sharedBrowserService.executeUserAction({
									type: 'press_key',
									key: 'ArrowLeft',
									timestamp: Date.now(),
									description: 'Navigate back',
								});
							}}
							className="p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Back"
							disabled={!browserState.isActive}
						>
							<ArrowLeft className="h-4 w-4" />
						</button>
						<button
							onClick={async () => {
								if (browserState.controlMode !== 'user') {
									await sharedBrowserService.assumeUserControl();
								}
								sharedBrowserService.executeUserAction({
									type: 'press_key',
									key: 'ArrowRight',
									timestamp: Date.now(),
									description: 'Navigate forward',
								});
							}}
							className="p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Forward"
							disabled={!browserState.isActive}
						>
							<ArrowRight className="h-4 w-4" />
						</button>
						<button
							onClick={async () => {
								if (browserState.controlMode !== 'user') {
									await sharedBrowserService.assumeUserControl();
								}
								if (browserState.currentUrl) {
									sharedBrowserService.executeUserAction({
										type: 'navigate',
										url: browserState.currentUrl,
										timestamp: Date.now(),
										description: 'Refresh page',
									});
								}
							}}
							className="p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Refresh"
							disabled={!browserState.isActive || !browserState.currentUrl}
						>
							<RefreshCw className="h-4 w-4" />
						</button>
					</div>
					{/* URL Input */}
					<div className="flex-1 flex items-center gap-2">
						<Globe className="h-4 w-4 text-[var(--void-fg-2)] flex-shrink-0" />
						<input
							type="text"
							value={urlInput}
							onChange={(e) => {
								setUrlInput(e.target.value);
								// Auto-assume control when user starts typing
								if (browserState.controlMode !== 'user') {
									sharedBrowserService.assumeUserControl();
								}
							}}
							onKeyDown={async (e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									await handleNavigate();
								}
							}}
							onFocus={() => {
								// Auto-assume control when input is focused
								if (browserState.controlMode !== 'user') {
									sharedBrowserService.assumeUserControl();
								}
							}}
							placeholder={browserState.currentUrl || "Enter URL..."}
							className="flex-1 px-2 py-1 text-sm bg-[var(--void-bg-2)] border border-[var(--void-border-4)] rounded text-[var(--void-fg-1)] focus:outline-none focus:border-[var(--void-border-3)] disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={!browserState.isActive}
						/>
					</div>
				</div>
			</div>

			{/* Viewport - Iframe Browser */}
			<div className="browser-viewport flex-1 overflow-hidden bg-[var(--void-bg-3)] relative" style={{ position: 'relative', zIndex: 1 }}>
				{browserState.currentUrl ? (
					<iframe
						src={browserState.currentUrl}
						className="w-full h-full border-0"
						sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox"
						title="Shared Browser"
						style={{ display: 'block', position: 'relative', zIndex: 1 }}
					/>
				) : (
					<div className="flex flex-col items-center justify-center text-center p-8 text-[var(--void-fg-4)] h-full">
						<Globe className="h-12 w-12 mb-4 opacity-50" />
						<p className="text-sm">No page loaded</p>
						<p className="text-xs mt-1">Enter a URL above to navigate</p>
					</div>
				)}
			</div>

			{/* Action History */}
			<div className="browser-actions-history flex flex-col border-t border-[var(--void-border-4)] bg-[var(--void-bg-2)] max-h-48 overflow-hidden" style={{ position: 'relative', zIndex: 10 }}>
				<div className="px-4 py-2 border-b border-[var(--void-border-4)] bg-[var(--void-bg-1)]">
					<h4 className="text-sm font-semibold text-[var(--void-fg-1)]">Action History</h4>
				</div>
				<div className="flex-1 overflow-y-auto">
					{browserState.actionHistory.length > 0 ? (
						<div className="divide-y divide-[var(--void-border-4)]">
							{browserState.actionHistory.slice().reverse().map((action, i) => (
								<div
									key={`${action.timestamp}-${i}`}
									className="browser-action-item px-4 py-2 hover:bg-[var(--void-bg-2-hover)] transition-colors"
								>
									<div className="flex items-start gap-3">
										<div className="flex-shrink-0 mt-0.5 text-[var(--void-fg-2)]">
											{getActionIcon(action.type)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-xs font-medium text-[var(--void-fg-1)] uppercase">
													{action.type}
												</span>
												<span className="text-xs text-[var(--void-fg-4)]">
													{formatTimestamp(action.timestamp)}
												</span>
											</div>
											<p className="text-sm text-[var(--void-fg-2)] break-words">
												{action.description}
											</p>
											{action.url && (
												<p className="text-xs text-[var(--void-fg-4)] mt-1 truncate">
													URL: {action.url}
												</p>
											)}
											{action.element && (
												<p className="text-xs text-[var(--void-fg-4)] mt-1 truncate">
													Element: {action.element}
												</p>
											)}
											{action.text && (
												<p className="text-xs text-[var(--void-fg-4)] mt-1 break-words">
													Text: "{action.text}"
												</p>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="px-4 py-8 text-center text-[var(--void-fg-4)] text-sm">
							No actions yet
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

