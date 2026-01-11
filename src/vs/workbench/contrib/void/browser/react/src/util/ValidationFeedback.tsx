/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { ValidationResult } from '../../../../common/validation.js';

interface ValidationFeedbackProps {
	validationResult: ValidationResult;
	onDismiss?: () => void;
	className?: string;
}

/**
 * Component that displays validation warnings and errors.
 * Non-blocking: shows warnings but doesn't prevent user from continuing.
 */
export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
	validationResult,
	onDismiss,
	className = '',
}) => {
	const { warnings, errors } = validationResult;

	if (warnings.length === 0 && errors.length === 0) {
		return null;
	}

	return (
		<div className={`space-y-2 ${className}`}>
			{/* Errors */}
			{errors.length > 0 && (
				<div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
					<div className="flex items-start gap-2">
						<AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
						<div className="flex-1 min-w-0">
							<div className="font-medium text-red-500 mb-1">Validation Errors</div>
							{errors.map((error, index) => (
								<div key={index} className="text-sm text-void-fg-2 mb-2 last:mb-0">
									<div>{error.message}</div>
									{error.suggestion && (
										<div className="text-void-fg-3 mt-1">{error.suggestion}</div>
									)}
									{error.code && (
										<div className="text-xs text-void-fg-3 mt-1 font-mono">
											Error code: {error.code}
										</div>
									)}
								</div>
							))}
						</div>
						{onDismiss && (
							<button
								onClick={onDismiss}
								className="text-void-fg-3 hover:text-void-fg-1 flex-shrink-0"
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>
			)}

			{/* Warnings */}
			{warnings.length > 0 && (
				<div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
					<div className="flex items-start gap-2">
						<Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
						<div className="flex-1 min-w-0">
							<div className="font-medium text-yellow-500 mb-1">Suggestions</div>
							{warnings.map((warning, index) => (
								<div key={index} className="text-sm text-void-fg-2 mb-2 last:mb-0">
									<div>{warning.message}</div>
									{warning.suggestion && (
										<div className="text-void-fg-3 mt-1">{warning.suggestion}</div>
									)}
								</div>
							))}
						</div>
						{onDismiss && (
							<button
								onClick={onDismiss}
								className="text-void-fg-3 hover:text-void-fg-1 flex-shrink-0"
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};







