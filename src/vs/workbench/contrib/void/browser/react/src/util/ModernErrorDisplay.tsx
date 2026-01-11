/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, X, HelpCircle } from 'lucide-react';
import { categorizeError, EnhancedError, isErrorRetryable } from '../../../../common/errorHandling.js';

interface ModernErrorDisplayProps {
	error: Error | unknown;
	onDismiss?: () => void;
	onRetry?: () => void;
	className?: string;
}

/**
 * Modern error display component with specific messages, suggestions, and documentation links.
 */
export const ModernErrorDisplay: React.FC<ModernErrorDisplayProps> = ({
	error,
	onDismiss,
	onRetry,
	className = '',
}) => {
	const enhancedError: EnhancedError = categorizeError(error);
	const canRetry = isErrorRetryable(error);

	const handleDocumentationClick = () => {
		if (enhancedError.documentationLink) {
			// Open in external browser
			window.open(enhancedError.documentationLink, '_blank');
		}
	};

	return (
		<div className={`
			p-4 rounded-lg border
			${enhancedError.category === 'network' 
				? 'bg-yellow-500/10 border-yellow-500/20' 
				: enhancedError.category === 'api'
					? 'bg-red-500/10 border-red-500/20'
					: 'bg-orange-500/10 border-orange-500/20'
			}
			${className}
		`}>
			<div className="flex items-start gap-3">
				{/* Icon */}
				<div className={`
					flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
					${enhancedError.category === 'network' 
						? 'bg-yellow-500/20 text-yellow-500' 
						: enhancedError.category === 'api'
							? 'bg-red-500/20 text-red-500'
							: 'bg-orange-500/20 text-orange-500'
					}
				`}>
					<AlertTriangle className="w-5 h-5" />
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Error Category Badge */}
					<div className="flex items-center gap-2 mb-2">
						<span className={`
							px-2 py-0.5 rounded text-xs font-medium uppercase
							${enhancedError.category === 'network' 
								? 'bg-yellow-500/20 text-yellow-500' 
								: enhancedError.category === 'api'
									? 'bg-red-500/20 text-red-500'
									: 'bg-orange-500/20 text-orange-500'
							}
						`}>
							{enhancedError.category}
						</span>
						{enhancedError.errorCode && (
							<span className="text-xs text-void-fg-3 font-mono">
								{enhancedError.errorCode}
							</span>
						)}
					</div>

					{/* Error Message */}
					<h3 className="font-semibold text-void-fg-1 mb-2">
						{enhancedError.message}
					</h3>

					{/* Suggestion */}
					{enhancedError.suggestion && (
						<p className="text-sm text-void-fg-2 mb-3">
							{enhancedError.suggestion}
						</p>
					)}

					{/* Actions */}
					<div className="flex items-center gap-2 flex-wrap">
						{canRetry && onRetry && (
							<button
								onClick={onRetry}
								className={`
									px-3 py-1.5 rounded text-sm font-medium
									flex items-center gap-2
									bg-void-bg-2 border border-void-border-2
									text-void-fg-1 hover:bg-void-bg-3 hover:border-void-border-3
									transition-colors
								`}
							>
								<RefreshCw className="w-4 h-4" />
								Retry
							</button>
						)}

						{enhancedError.documentationLink && (
							<button
								onClick={handleDocumentationClick}
								className={`
									px-3 py-1.5 rounded text-sm font-medium
									flex items-center gap-2
									bg-void-bg-2 border border-void-border-2
									text-void-fg-1 hover:bg-void-bg-3 hover:border-void-border-3
									transition-colors
								`}
							>
								<HelpCircle className="w-4 h-4" />
								Documentation
								<ExternalLink className="w-3 h-3" />
							</button>
						)}

						{onDismiss && (
							<button
								onClick={onDismiss}
								className="px-3 py-1.5 rounded text-sm text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-2 transition-colors"
							>
								Dismiss
							</button>
						)}
					</div>

					{/* Original error details (collapsible for debugging) */}
					{enhancedError.originalError && process.env.NODE_ENV === 'development' && (
						<details className="mt-3">
							<summary className="text-xs text-void-fg-3 cursor-pointer hover:text-void-fg-2">
								Technical details
							</summary>
							<pre className="mt-2 p-2 bg-void-bg-2 rounded text-xs text-void-fg-3 overflow-auto max-h-40">
								{enhancedError.originalError.stack || enhancedError.originalError.message}
							</pre>
						</details>
					)}
				</div>

				{/* Dismiss button (top right) */}
				{onDismiss && (
					<button
						onClick={onDismiss}
						className="flex-shrink-0 text-void-fg-3 hover:text-void-fg-1 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				)}
			</div>
		</div>
	);
};







