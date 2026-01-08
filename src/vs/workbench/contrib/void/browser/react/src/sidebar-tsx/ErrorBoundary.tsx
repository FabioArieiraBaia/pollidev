/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WarningBox } from '../void-settings-tsx/WarningBox.js';
import { useFeatureFlag } from '../util/featureFlags.js';
import { ModernErrorDisplay } from '../util/ModernErrorDisplay.js';

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onDismiss?: () => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null
		};
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		return {
			hasError: true,
			error
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		this.setState({
			error,
			errorInfo
		});
	}

	render(): ReactNode {
		if (this.state.hasError && this.state.error) {
			// If a custom fallback is provided, use it
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Use modern error display if enhanced errors feature is enabled
			// Check via a wrapper component since we can't use hooks in class components
			return (
				<ErrorBoundaryErrorDisplay
					error={this.state.error}
					onDismiss={this.props.onDismiss}
				/>
			);
		}

		return this.props.children;
	}
}

/**
 * Wrapper component to use feature flag hook with class-based ErrorBoundary.
 */
const ErrorBoundaryErrorDisplay: React.FC<{ error: Error; onDismiss?: () => void }> = ({ error, onDismiss }) => {
	const useEnhancedErrors = useFeatureFlag('enhancedErrors');

	if (useEnhancedErrors) {
		return (
			<ModernErrorDisplay
				error={error}
				onDismiss={onDismiss}
			/>
		);
	}

	// Fallback to legacy warning box
	return <WarningBox text={error.message || String(error)} />;
};

export default ErrorBoundary;
