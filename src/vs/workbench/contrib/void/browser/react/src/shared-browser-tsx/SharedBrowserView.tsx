/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState, useRef } from 'react';
import { X, Globe, MousePointer, Type, Camera, Maximize2, Move, ArrowLeft, ArrowRight, RefreshCw, User, Bot, Loader2 } from 'lucide-react';
import { useAccessor } from '../util/services.js';
import { ISharedBrowserService, SharedBrowserState, BrowserAction } from '../../../../common/sharedBrowserService.js';

// --- Existing actionIcons ---
const actionIcons: Record<string, React.ReactNode> = {
    navigate: <Globe className="h-4 w-4" />,
    click: <MousePointer className="h-4 w-4" />,
    type: <Type className="h-4 w-4" />,
    snapshot: <Camera className="h-4 w-4" />,
    screenshot: <Camera className="h-4 w-4" />,
    hover: <Move className="h-4 w-4" />,
    scroll: <Maximize2 className="h-4 w-4" />,
};

// --- Define NavigationBar Component ---
interface NavigationBarProps {
    currentUrl: string | null;
    favicon: string | undefined;
    isLoading: boolean;
    onNavigate: (url: string) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onHome: () => void;
    isBrowserActive: boolean;
    isUserControl: boolean;
    assumeUserControl: () => Promise<void>;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    currentUrl,
    favicon,
    isLoading,
    onNavigate,
    onBack,
    onForward,
    onReload,
    onHome,
    isBrowserActive,
    isUserControl,
    assumeUserControl,
}) => {
    const [urlInput, setUrlInput] = useState<string>(currentUrl || '');

    // Update input when currentUrl changes
    useEffect(() => {
        setUrlInput(currentUrl || '');
    }, [currentUrl]);

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const url = urlInput.trim();
            if (url) {
                let navUrl = url;
                if (!navUrl.startsWith('http://') && !navUrl.startsWith('https://')) {
                    navUrl = 'https://' + navUrl;
                }
                onNavigate(navUrl);
            }
        }
    };

    const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrlInput(e.target.value);
    };

    const handleFocusOrInput = async () => {
        if (!isUserControl) {
            await assumeUserControl();
        }
    };

    return (
        <div className="navigation-bar flex items-center px-4 py-2 bg-[var(--void-bg-1)] border-b border-[var(--void-border-4)]" style={{ position: 'relative', zIndex: 100 }}>
            {/* Navigation Controls */}
            <div className="flex items-center gap-1 mr-2">
                <button
                    onClick={onBack}
                    className="nav-button p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Back"
                    disabled={!isBrowserActive || isLoading} // Disable while loading
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={onForward}
                    className="nav-button p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Forward"
                    disabled={!isBrowserActive || isLoading} // Disable while loading
                >
                    <ArrowRight className="h-4 w-4" />
                </button>
                <button
                    onClick={onReload}
                    className="nav-button p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh"
                    disabled={!isBrowserActive || isLoading} // Disable while loading
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button
                    onClick={onHome}
                    className="nav-button p-1 rounded hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-2)] hover:text-[var(--void-fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Home"
                    disabled={!isBrowserActive || isLoading}
                >
                    <Globe className="h-4 w-4" />
                </button>
            </div>

            {/* URL Input */}
            <div className="flex-1 flex items-center gap-2 url-input-container">
                {favicon && (
                    <img src={favicon} alt="Favicon" className="favicon h-4 w-4 flex-shrink-0" />
                )}
                <input
                    type="text"
                    value={urlInput}
                    onChange={handleUrlInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocusOrInput}
                    placeholder="Enter URL..."
                    className="url-input flex-1 px-2 py-1 text-sm bg-[var(--void-bg-2)] border border-[var(--void-border-4)] rounded text-[var(--void-fg-1)] focus:outline-none focus:border-[var(--void-border-3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isBrowserActive}
                />
            </div>
        </div>
    );
};

// --- Define ActionHistoryPanel Component ---
interface ActionHistoryPanelProps {
    actions: BrowserAction[];
    onClear: () => void;
    isExpanded: boolean;
    setIsExpanded: (expanded: boolean) => void;
}

const ActionHistoryPanel: React.FC<ActionHistoryPanelProps> = ({ actions, onClear, isExpanded, setIsExpanded }) => {
    const historyRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to last action
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [actions]);

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getActionIcon = (type: string) => {
        const icons: { [key: string]: string } = {
            navigate: '🌐',
            click: '👆',
            type: '⌨️',
            scroll: '📜',
            hover: '👁️',
            wait_for: '⏱️',
            screenshot: '📸',
            snapshot: '📋'
        };
        return icons[type] || '•';
    };

    return (
        <div className="action-history-panel border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
            <div className="panel-header flex justify-between items-center px-4 py-2 bg-[var(--vscode-sideBarTitle-background)] border-b border-[var(--vscode-panel-border)]">
                <button
                    className="toggle-button flex items-center gap-1 text-sm font-semibold text-[var(--vscode-foreground)]"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? '▼' : '▶'} Histórico de Ações ({actions.length})
                </button>
                <button className="clear-button bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] px-2 py-1 rounded text-xs" onClick={onClear}>
                    🗑️ Limpar
                </button>
            </div>

            {isExpanded && (
                <div className="action-list max-h-48 overflow-y-auto px-4 py-2" ref={historyRef}>
                    {actions.length === 0 ? (
                        <div className="empty-message text-center py-4 text-[var(--vscode-descriptionForeground)] italic">
                            Nenhuma ação executada ainda
                        </div>
                    ) : (
                        actions.map((action, index) => (
                            <div
                                key={index}
                                className={`action-item action-${action.type} flex items-center gap-2 py-1 mb-1 text-sm`}
                            >
                                <span className="action-icon text-lg">
                                    {getActionIcon(action.type)}
                                </span>
                                <span className="action-time text-xs text-[var(--vscode-descriptionForeground)] min-w-[65px]">
                                    {formatTime(action.timestamp!)}
                                </span>
                                <span className="action-description flex-1 text-[var(--vscode-foreground)] break-words">
                                    {action.description}
                                </span>
                                {action.element && (
                                    <span className="action-element text-[var(--vscode-textLink-foreground)] text-xs italic truncate max-w-xs">
                                        → {action.element}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};


// --- Main SharedBrowserView Component ---
export const SharedBrowserView = () => {
    const accessor = useAccessor();
    const sharedBrowserService = accessor.get('ISharedBrowserService') as ISharedBrowserService;
    const [browserState, setBrowserState] = useState<SharedBrowserState>(sharedBrowserService.state);
    const [urlInput, setUrlInput] = useState<string>(browserState.currentUrl || '');
    const [showHistory, setShowHistory] = useState<boolean>(true); // State to toggle history panel

    // Effect to update state and URL input from service
    useEffect(() => {
        const updateStateAndUrl = () => {
            setBrowserState(sharedBrowserService.state);
            setUrlInput(sharedBrowserService.state.currentUrl || '');
        };

        updateStateAndUrl(); // Initial state

        const disposable = sharedBrowserService.onDidUpdateState(updateStateAndUrl);
        return () => disposable.dispose();
    }, [sharedBrowserService]);

    // Handlers for NavigationBar
    const handleNavigate = async (url: string) => {
        if (!url.trim()) return;

        // Ensure user control before navigation
        if (browserState.controlMode !== 'user') {
            await sharedBrowserService.assumeUserControl();
            // Wait for state to update - poll until control mode changes
            let attempts = 0;
            while (sharedBrowserService.state.controlMode !== 'user' && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            if (sharedBrowserService.state.controlMode !== 'user') {
                console.error('[SharedBrowserView] Failed to assume user control for navigation');
                return;
            }
        }

        try {
            await sharedBrowserService.executeUserAction({
                type: 'navigate',
                url: url,
                timestamp: Date.now(),
                description: `Navigate to ${url}`,
            });
            // Update input with normalized URL after successful navigation
            setUrlInput(url);
        } catch (error) {
            console.error('[SharedBrowserView] Navigation error:', error);
        }
    };

    const handleBack = async () => {
        if (browserState.controlMode !== 'user') await sharedBrowserService.assumeUserControl();
        // Use goBack from service
        await sharedBrowserService.goBack();
    };

    const handleForward = async () => {
        if (browserState.controlMode !== 'user') await sharedBrowserService.assumeUserControl();
        // Use goForward from service
        await sharedBrowserService.goForward();
    };

    const handleReload = async () => {
        if (browserState.controlMode !== 'user') await sharedBrowserService.assumeUserControl();
        // Use reload from service
        await sharedBrowserService.reload();
    };

    const handleHome = () => {
        // Implement Home navigation logic, e.g., navigate to a default URL
        handleNavigate('https://www.google.com'); // Example home URL
    };

    // Toggle user/agent control
    const handleControlToggle = () => {
        if (browserState.controlMode === 'agent') {
            sharedBrowserService.assumeUserControl();
        } else {
            sharedBrowserService.returnToAgentControl();
        }
    };

    // Handle clearing action history
    const handleClearHistory = () => {
        sharedBrowserService.clearActionHistory();
    };

    if (!browserState.isActive) {
        return null; // Render nothing if browser is not active
    }

    return (
        <div className="shared-browser-view flex flex-col border-t border-[var(--void-border-4)] bg-[var(--void-bg-2)]" style={{ position: 'relative', height: '100%', zIndex: 1 }}>
            {/* Header */}
            <div className="browser-header flex items-center justify-between px-4 py-2 border-b border-[var(--void-border-4)] bg-[var(--void-bg-2)]" style={{ position: 'relative', zIndex: 1000 }}>
                <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-[var(--void-fg-1)]" />
                    <span className="text-[var(--void-fg-1)] font-semibold">Shared Browser</span>
                    {/* Control Mode Indicator */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${browserState.controlMode === 'agent' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
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

            {/* Navigation Bar */}
            <NavigationBar
                currentUrl={browserState.currentUrl}
                favicon={browserState.favicon}
                isLoading={browserState.isLoading}
                onNavigate={handleNavigate}
                onBack={handleBack}
                onForward={handleForward}
                onReload={handleReload}
                onHome={handleHome}
                isBrowserActive={browserState.isActive}
                isUserControl={browserState.controlMode === 'user'}
                assumeUserControl={async () => sharedBrowserService.assumeUserControl()}
            />

            {/* Viewport - Shared Browser Status */}
            <div className="browser-viewport flex-1 overflow-hidden bg-[var(--void-bg-3)] relative flex flex-col items-center justify-center text-center p-8" style={{ position: 'relative', zIndex: 1 }}>
                {browserState.isLoading ? (
                    <div className="loading-indicator flex flex-col items-center justify-center">
                        <Loader2 className="h-12 w-12 animate-spin text-[var(--void-fg-1)]" />
                        <p className="mt-4 text-[var(--void-fg-1)] font-medium">Carregando página...</p>
                        <p className="text-xs text-[var(--void-fg-3)] mt-1">{browserState.currentUrl}</p>
                    </div>
                ) : browserState.currentUrl ? (
                    <div className="flex flex-col items-center justify-center">
                        <div className="bg-green-500/10 p-4 rounded-full mb-4">
                            <Globe className="h-12 w-12 text-green-500" />
                        </div>
                        <p className="text-[var(--void-fg-1)] font-medium">Navegador Compartilhado Ativo</p>
                        <p className="text-xs text-[var(--void-fg-3)] mt-2 max-w-xs break-all">
                            {browserState.currentUrl}
                        </p>
                        <div className="mt-6 flex gap-2">
                            <button 
                                onClick={() => handleReload()}
                                className="px-4 py-2 bg-[var(--void-bg-1)] hover:bg-[var(--void-bg-2-hover)] text-[var(--void-fg-1)] rounded border border-[var(--void-border-4)] text-sm transition-colors"
                            >
                                Atualizar Janela
                            </button>
                        </div>
                        <p className="text-[var(--void-fg-4)] text-[10px] mt-8 max-w-xs">
                            Nota: Por segurança, alguns sites (como GitHub) não podem ser exibidos dentro do VS Code. 
                            Use a janela externa que foi aberta para interagir.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center">
                        <Globe className="h-12 w-12 mb-4 opacity-20 text-[var(--void-fg-1)]" />
                        <p className="text-sm text-[var(--void-fg-3)]">Nenhuma página carregada</p>
                        <p className="text-xs mt-1 text-[var(--void-fg-4)]">Digite uma URL acima para começar</p>
                    </div>
                )}
            </div>

            {/* Action History Panel */}
            <ActionHistoryPanel
                actions={browserState.actionHistory}
                onClear={handleClearHistory}
                isExpanded={showHistory}
                setIsExpanded={setShowHistory}
            />
        </div>
    );
};