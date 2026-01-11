/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { VoidChatArea, VoidChatAreaProps } from './SidebarChat.js';

/**
 * Modern chat area wrapper with improved design, animations, and visual feedback.
 * Wraps the existing VoidChatArea with modern styling.
 */
export const ModernChatArea: React.FC<VoidChatAreaProps> = (props) => {
	return (
		<div className="relative">
			{/* Modern styling wrapper */}
			<div className="
				rounded-lg
				shadow-sm
				border border-void-border-1
				bg-void-bg-1
				overflow-hidden
				transition-all duration-200
				hover:shadow-md
			">
				{/* Status indicator bar */}
				{props.isStreaming && (
					<div className="
						h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500
						animate-pulse
						relative overflow-hidden
					">
						<div className="
							absolute inset-0
							bg-gradient-to-r from-transparent via-white/30 to-transparent
							animate-[shimmer_2s_infinite]
						" />
					</div>
				)}

				{/* Chat content */}
				<div className={`
					${props.className || ''}
					transition-opacity duration-200
					${props.isDisabled ? 'opacity-50 pointer-events-none' : ''}
				`}>
					<VoidChatArea {...props} />
				</div>
			</div>

			{/* Loading overlay with animation */}
			{props.isStreaming && props.loadingIcon && (
				<div className="
					absolute inset-0
					bg-void-bg-1/50
					backdrop-blur-sm
					flex items-center justify-center
					pointer-events-none
					z-10
					animate-fade-in
				">
					<div className="
						p-3 rounded-full
						bg-void-bg-2 border border-void-border-2
						shadow-lg
						animate-pulse
					">
						{props.loadingIcon}
					</div>
				</div>
			)}
		</div>
	);
};







