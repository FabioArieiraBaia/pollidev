/*--------------------------------------------------------------------------------------
 *  Copyright 2025 PolliDev. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';

const POLLIDEV_THEME_MIGRATION_KEY = 'pollidev.themeMigrationDone.v1';
const POLLIDEV_DEFAULT_THEME = 'PolliDev Vibrant';

/**
 * PolliDev Theme Migration Service
 * 
 * Ensures that on first run (or after migration), the PolliDev Vibrant theme
 * is applied as the default theme for new users.
 */
export class PolliDevThemeMigrationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.pollidevThemeMigration';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService,
	) {
		super();
		this.migrateThemeIfNeeded();
	}

	private async migrateThemeIfNeeded(): Promise<void> {
		// Check if migration was already done
		const migrationDone = this.storageService.getBoolean(
			POLLIDEV_THEME_MIGRATION_KEY,
			StorageScope.PROFILE,
			false
		);

		if (migrationDone) {
			return; // Already migrated, respect user's choice
		}

		// Check current theme setting
		const currentTheme = this.configurationService.getValue<string>('workbench.colorTheme');

		// List of "default" themes that we should override
		const defaultThemesToOverride = [
			'Default Dark Modern',
			'Default Dark+',
			'Default Light Modern',
			'Default Light+',
			'Visual Studio Dark',
			'Visual Studio Light',
			'Void Dark', // Previous void theme
			undefined,
			''
		];

		// If user has a default theme or no theme, apply PolliDev Vibrant
		if (!currentTheme || defaultThemesToOverride.includes(currentTheme)) {
			try {
				await this.themeService.setColorTheme(POLLIDEV_DEFAULT_THEME, undefined);
				console.log('[PolliDev] Theme migrated to PolliDev Vibrant');
			} catch (error) {
				console.warn('[PolliDev] Failed to set theme:', error);
			}
		}

		// Mark migration as done
		this.storageService.store(
			POLLIDEV_THEME_MIGRATION_KEY,
			true,
			StorageScope.PROFILE,
			StorageTarget.USER
		);
	}
}

// Register the contribution to run on workbench ready
registerWorkbenchContribution2(
	PolliDevThemeMigrationContribution.ID,
	PolliDevThemeMigrationContribution,
	WorkbenchPhase.AfterRestored
);
