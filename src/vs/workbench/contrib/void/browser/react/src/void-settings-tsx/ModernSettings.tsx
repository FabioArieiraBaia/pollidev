/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

/**
 * Modern settings wrapper component.
 * This would wrap the existing Settings component with improved layout and organization.
 * For now, this is a placeholder that can be extended.
 */
export const ModernSettings: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return (
		<div className="
			flex flex-col gap-6
			rounded-lg
			shadow-sm
			bg-void-bg-1
			border border-void-border-1
			p-6
		">
			{children}
		</div>
	);
};



