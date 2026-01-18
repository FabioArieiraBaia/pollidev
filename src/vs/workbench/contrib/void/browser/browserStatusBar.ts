/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntry, IStatusbarEntryAccessor } from '../../../services/statusbar/browser/statusbar.js';
import { ISharedBrowserService, SharedBrowserState } from '../common/sharedBrowserService.js';
import { VOID_OPEN_BROWSER_ACTION_ID } from './actionIDs.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

/**
 * Status bar contribution that shows browser state and allows quick access
 */
class BrowserStatusBarContribution extends Disposable implements IWorkbenchContribution {
	private entryAccessor: IStatusbarEntryAccessor | undefined;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@ISharedBrowserService private readonly browserService: ISharedBrowserService
	) {
		super();
		
		this.createStatusBarEntry();
		this.registerListeners();
	}

	/**
	 * Create the initial status bar entry
	 */
	private createStatusBarEntry(): void {
		const entry = this.createEntry(this.browserService.state);
		this.entryAccessor = this.statusbarService.addEntry(
			entry,
			'void.browser.statusbar',
			StatusbarAlignment.RIGHT,
			100 // Priority (higher = more to the right)
		);
	}

	/**
	 * Register listeners for state changes
	 */
	private registerListeners(): void {
		// Listen to browser state changes
		this._register(
			this.browserService.onDidUpdateState(() => {
				this.updateStatusBar();
			})
		);
	}

	/**
	 * Update status bar based on current browser state
	 */
	private updateStatusBar(): void {
		if (this.entryAccessor) {
			const entry = this.createEntry(this.browserService.state);
			this.entryAccessor.update(entry);
		}
	}

	/**
	 * Create status bar entry object based on state
	 */
	private createEntry(state: SharedBrowserState): IStatusbarEntry {
		let text: string;
		let tooltip: string;
		let color: string | undefined;

		if (state.isActive) {
			// Browser is active
			text = `$(browser) Browser`;
			color = '#4CAF50'; // Green
			tooltip = state.currentUrl || 'Browser is active';
		} else {
			// Browser is inactive
			text = `$(browser) Browser`;
			color = '#999999'; // Gray
			tooltip = 'Browser is inactive (Click to open)';
		}

		return {
			name: 'Void Browser',
			text: text,
			tooltip: tooltip,
			command: VOID_OPEN_BROWSER_ACTION_ID,
			color: color,
			backgroundColor: undefined,
			ariaLabel: 'Void Browser Status'
		};
	}

	override dispose(): void {
		super.dispose();
		this.entryAccessor?.dispose();
	}
}

// Register as workbench contribution - THIS IS THE KEY PART
registerWorkbenchContribution2(
	'workbench.contrib.void.browserStatusBar',
	BrowserStatusBarContribution,
	WorkbenchPhase.BlockRestore
);
