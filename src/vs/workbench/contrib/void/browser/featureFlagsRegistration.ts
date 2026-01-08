/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import * as nls from '../../../../nls.js';

/**
 * Register feature flags as experimental configuration settings.
 * These can be toggled by users via settings.json or the settings UI.
 */
const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);

configurationRegistry.registerConfiguration({
	id: 'void',
	title: nls.localize('voidConfigurationTitle', 'Void'),
	type: 'object',
	properties: {
		'void.featureFlags.modernModelSelector': {
			type: 'boolean',
			default: false,  // Disabled by default - user prefers legacy selector
			description: nls.localize(
				'void.featureFlags.modernModelSelector.description',
				'Enable modern model selector UI with cards, filters, and search. (Experimental)'
			),
			tags: ['onExp'],
			scope: ConfigurationScope.APPLICATION,
		},
		'void.featureFlags.modernChatUI': {
			type: 'boolean',
			default: true,  // Enabled by default to apply UI modernization plan
			description: nls.localize(
				'void.featureFlags.modernChatUI.description',
				'Enable modern chat UI with improved design, animations, and visual feedback. (Experimental)'
			),
			tags: ['onExp'],
			scope: ConfigurationScope.APPLICATION,
		},
		'void.featureFlags.modernSettings': {
			type: 'boolean',
			default: true,  // Enabled by default to apply UI modernization plan
			description: nls.localize(
				'void.featureFlags.modernSettings.description',
				'Enable modern settings panel with improved layout and organization. (Experimental)'
			),
			tags: ['onExp'],
			scope: ConfigurationScope.APPLICATION,
		},
		'void.featureFlags.enhancedErrors': {
			type: 'boolean',
			default: true,  // Enabled by default to apply UI modernization plan
			description: nls.localize(
				'void.featureFlags.enhancedErrors.description',
				'Enable enhanced error messages with specific suggestions and documentation links. (Experimental)'
			),
			tags: ['onExp'],
			scope: ConfigurationScope.APPLICATION,
		},
	}
});

