/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

/**
 * Feature flags for modernizing the Void UI.
 * All flags are experimental and can be toggled via settings.
 */
export type FeatureFlagName = 
	| 'modernModelSelector'
	| 'modernChatUI'
	| 'modernSettings'
	| 'enhancedErrors';

/**
 * Default values for feature flags.
 * Flags default to false (disabled) for maximum safety.
 */
const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagName, boolean> = {
	modernModelSelector: false,  // Disabled - user prefers legacy selector
	modernChatUI: false,         // Enable modern chat design with animations and feedback
	modernSettings: false,       // Enable improved settings layout
	enhancedErrors: false,       // Enable specific error messages with suggestions
};

/**
 * Configuration key prefix for Void feature flags.
 */
const FEATURE_FLAG_PREFIX = 'void.featureFlags.';

/**
 * Check if a feature flag is enabled.
 * 
 * @param configurationService - The configuration service instance
 * @param flagName - Name of the feature flag to check
 * @returns true if the flag is enabled, false otherwise (with safe fallback)
 */
export function isFeatureEnabled(
	configurationService: IConfigurationService,
	flagName: FeatureFlagName
): boolean {
	try {
		const configKey = `${FEATURE_FLAG_PREFIX}${flagName}`;
		const value = configurationService.getValue<boolean | undefined>(configKey);
		
		// If value is explicitly set (not undefined), use it
		if (value !== undefined) {
			return value === true;
		}
		
		// Otherwise, use default (which is always false for safety)
		return DEFAULT_FEATURE_FLAGS[flagName] ?? false;
	} catch (error) {
		// On any error, always fallback to false (disabled) for maximum safety
		console.error(`[FeatureFlags] Error checking flag ${flagName}:`, error);
		return false;
	}
}

/**
 * Get all feature flags as a record.
 * Useful for debugging or monitoring.
 */
export function getAllFeatureFlags(
	configurationService: IConfigurationService
): Record<FeatureFlagName, boolean> {
	const result: Partial<Record<FeatureFlagName, boolean>> = {};
	
	for (const flagName of Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagName[]) {
		result[flagName] = isFeatureEnabled(configurationService, flagName);
	}
	
	return result as Record<FeatureFlagName, boolean>;
}

