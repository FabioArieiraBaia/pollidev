/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';

interface ComponentWrapperProps {
	/**
	 * The modern/new version of the component to render when feature flag is enabled.
	 */
	modernComponent: ReactNode;
	
	/**
	 * The legacy/old version of the component to render as fallback.
	 */
	legacyComponent: ReactNode;
	
	/**
	 * Whether the feature flag for this component is enabled.
	 */
	featureEnabled: boolean;
	
	/**
	 * Optional callback when an error occurs and fallback happens.
	 */
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ComponentWrapperState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Component wrapper that safely switches between modern and legacy components.
 * 
 * Features:
 * - Renders modern component if feature flag is enabled AND no errors
 * - Automatically falls back to legacy component if feature flag is disabled OR error occurs
 * - Logs errors for monitoring
 * - Provides error boundary protection
 * 
 * @example
 * ```tsx
 * <ComponentWrapper
 *   modernComponent={<ModernComponent {...props} />}
 *   legacyComponent={<LegacyComponent {...props} />}
 *   featureEnabled={useFeatureFlag('modernModelSelector')}
 * />
 * ```
 */
export class ComponentWrapper extends Component<ComponentWrapperProps, ComponentWrapperState> {
	constructor(props: ComponentWrapperProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ComponentWrapperState> {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// Log error for monitoring
		console.error('[ComponentWrapper] Error in modern component, falling back to legacy:', error);
		console.error('[ComponentWrapper] Error info:', errorInfo);
		
		// Call optional error callback
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}
	}

	componentDidUpdate(prevProps: ComponentWrapperProps): void {
		// Reset error state if feature flag is disabled or component changes
		if (this.state.hasError && (!this.props.featureEnabled || prevProps.modernComponent !== this.props.modernComponent)) {
			this.setState({
				hasError: false,
				error: null,
			});
		}
	}

	render(): ReactNode {
		const { modernComponent, legacyComponent, featureEnabled } = this.props;
		const { hasError } = this.state;

		// If feature is disabled OR there's an error, use legacy component
		if (!featureEnabled || hasError) {
			return legacyComponent;
		}

		// Wrap modern component in ErrorBoundary for additional protection
		return (
			<ErrorBoundary
				fallback={legacyComponent}
				onDismiss={() => {
					// Reset error state when dismissed
					this.setState({ hasError: false, error: null });
				}}
			>
				{modernComponent}
			</ErrorBoundary>
		);
	}
}

/**
 * Functional wrapper version for convenience.
 * Uses ComponentWrapper internally with ErrorBoundary protection.
 */
export const SafeComponentWrapper: React.FC<ComponentWrapperProps> = (props) => {
	return <ComponentWrapper {...props} />;
};


