/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect, useState } from 'react';
import { useAccessor } from './services.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { FeatureFlagName, isFeatureEnabled } from '../../../../common/featureFlags.js';
import { IConfigurationChangeEvent } from '../../../../../../../platform/configuration/common/configuration.js';

/**
 * React hook to check if a feature flag is enabled.
 * Automatically updates when the configuration changes.
 * 
 * @param flagName - Name of the feature flag to check
 * @returns true if the flag is enabled, false otherwise
 * 
 * @example
 * ```tsx
 * const useModernUI = useFeatureFlag('modernModelSelector');
 * return useModernUI ? <ModernComponent /> : <LegacyComponent />;
 * ```
 */
export const useFeatureFlag = (flagName: FeatureFlagName): boolean => {
	const accessor = useAccessor();
	const configurationService = accessor.get('IConfigurationService') as IConfigurationService;
	
	const [isEnabled, setIsEnabled] = useState(() => {
		try {
			return isFeatureEnabled(configurationService, flagName);
		} catch (error) {
			console.error(`[useFeatureFlag] Error initializing flag ${flagName}:`, error);
			return false; // Safe fallback
		}
	});
	
	useEffect(() => {
		// Listen for configuration changes
		const disposable = configurationService.onDidChangeConfiguration((e: IConfigurationChangeEvent) => {
			const configKey = `void.featureFlags.${flagName}`;
			if (e.affectsConfiguration(configKey)) {
				try {
					const newValue = isFeatureEnabled(configurationService, flagName);
					setIsEnabled(newValue);
				} catch (error) {
					console.error(`[useFeatureFlag] Error updating flag ${flagName}:`, error);
					setIsEnabled(false); // Safe fallback
				}
			}
		});
		
		return () => {
			disposable.dispose();
		};
	}, [configurationService, flagName]);
	
	return isEnabled;
};



