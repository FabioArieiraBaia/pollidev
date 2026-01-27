/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	Extensions as ViewExtensions,
	ViewContainerLocation,
	IViewDescriptorService,
} from '../../../common/views.js';

import * as nls from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';

// ---------- Define viewpane host (no React here; AgentManagerViewPane mounts its own React) ----------

class AgentsEmptyHostViewPane extends ViewPane {
	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}
}

// ---------- Register "Agents" view container ----------

export const POLLIDEV_AGENTS_VIEW_CONTAINER_ID = 'workbench.view.pollidevAgents';
export const POLLIDEV_AGENTS_HOST_VIEW_ID = 'workbench.view.pollidevAgents.host';

const agentsViewIcon = registerIcon('pollidev-agents-view-icon', Codicon.robot, nls.localize('pollidevAgentsViewIcon', 'PolliDev agents view icon.'));

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
export const POLLIDEV_AGENTS_CONTAINER = viewContainerRegistry.registerViewContainer({
	id: POLLIDEV_AGENTS_VIEW_CONTAINER_ID,
	title: nls.localize2('pollidevAgentsContainer', 'Agents'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [POLLIDEV_AGENTS_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.VERTICAL,
	}]),
	hideIfEmpty: false,
	order: 2,
	rejectAddedViews: true,
	icon: agentsViewIcon,
}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: true, isDefault: false });

// Host view (hidden label) so the container can exist even if other views toggle.
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([
	{
		id: POLLIDEV_AGENTS_HOST_VIEW_ID,
		hideByDefault: true,
		name: nls.localize2('pollidevAgentsHost', ''),
		ctorDescriptor: new SyncDescriptor(AgentsEmptyHostViewPane),
		canToggleVisibility: false,
		canMoveView: false,
		weight: 1,
		order: 99,
	},
], POLLIDEV_AGENTS_CONTAINER);
