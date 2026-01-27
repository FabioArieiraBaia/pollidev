/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import type { IViewDescriptor } from '../../../common/views.js';
import { POLLIDEV_AGENTS_CONTAINER } from './agentsPane.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { AgentManagerViewPane } from './agentManagerPane.js';
import * as nls from '../../../../nls.js';

// Register AgentManagerViewPane into the dedicated "Agents" container (AuxiliaryBar)
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
const viewDescriptor: IViewDescriptor = {
	id: AgentManagerViewPane.ID,
	name: nls.localize2('agentManager', 'Agents'),
	ctorDescriptor: new SyncDescriptor(AgentManagerViewPane),
	canToggleVisibility: true,
	canMoveView: false,
	weight: 100,
	order: 0,
};
viewsRegistry.registerViews([viewDescriptor], POLLIDEV_AGENTS_CONTAINER);
