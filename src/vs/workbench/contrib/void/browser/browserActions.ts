/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { ISharedBrowserService } from '../common/sharedBrowserService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { VOID_OPEN_BROWSER_ACTION_ID, VOID_TAKE_SCREENSHOT_ACTION_ID, VOID_BROWSER_SNAPSHOT_ACTION_ID } from './actionIDs.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';

// ---------- Browser Actions ----------

// Open Shared Browser
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPEN_BROWSER_ACTION_ID,
			f1: true,
			title: localize2('voidOpenBrowser', 'Void: Open Shared Browser'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB,
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined
			},
			menu: {
				id: MenuId.EditorContext,
				group: 'void',
				order: 1
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const browserService = accessor.get(ISharedBrowserService);
		const notificationService = accessor.get(INotificationService);
		
		try {
			// Open background browser window
			await browserService.open();
			
			notificationService.notify({
				severity: Severity.Info,
				message: 'Shared browser window opened',
			});
		} catch (error) {
			notificationService.notify({
				severity: Severity.Error,
				message: `Failed to open browser: ${error}`,
			});
		}
	}
});

// Take Screenshot
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_TAKE_SCREENSHOT_ACTION_ID,
			f1: true,
			title: localize2('voidTakeScreenshot', 'Void: Take Browser Screenshot'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined
			},
			menu: {
				id: MenuId.EditorContext,
				group: 'void',
				order: 2
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const browserService = accessor.get(ISharedBrowserService);
		const notificationService = accessor.get(INotificationService);
		
		try {
			// Ensure browser is open first
			if (!browserService.state.isActive) {
				await browserService.open();
			}
			
			// Execute browser action to take screenshot
			await browserService.executeUserAction({
				type: 'screenshot',
				timestamp: Date.now(),
				description: 'User requested screenshot'
			});
			
			notificationService.notify({
				severity: Severity.Info,
				message: 'Screenshot captured successfully',
			});
		} catch (error) {
			notificationService.notify({
				severity: Severity.Error,
				message: `Failed to take screenshot: ${error}`,
			});
		}
	}
});

// Browser Snapshot
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_BROWSER_SNAPSHOT_ACTION_ID,
			f1: true,
			title: localize2('voidBrowserSnapshot', 'Void: Capture Browser Snapshot'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN,
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined
			},
			menu: {
				id: MenuId.EditorContext,
				group: 'void',
				order: 3
			}
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const browserService = accessor.get(ISharedBrowserService);
		const notificationService = accessor.get(INotificationService);
		
		try {
			// Ensure browser is open first
			if (!browserService.state.isActive) {
				await browserService.open();
			}
			
			// Execute browser action to capture snapshot
			await browserService.executeUserAction({
				type: 'snapshot',
				timestamp: Date.now(),
				description: 'User requested snapshot'
			});
			
			notificationService.notify({
				severity: Severity.Info,
				message: 'Browser snapshot captured',
			});
		} catch (error) {
			notificationService.notify({
				severity: Severity.Error,
				message: `Failed to capture snapshot: ${error}`,
			});
		}
	}
});
