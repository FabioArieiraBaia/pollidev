/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeatureName, ModelSelection, modelSelectionsEqual } from '../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js';
import { useSettingsState, useAccessor } from '../util/services.js';
import { ModelOption, modelFilterOfFeatureName } from '../../../../../../../workbench/contrib/void/common/voidSettingsService.js';
import { getModelCapabilities } from '../../../../../../../workbench/contrib/void/common/modelCapabilities.js';
import { Search, Filter, X, Check, Zap, Eye, Mic, Video, Wrench } from 'lucide-react';

interface ModernModelSelectorProps {
	featureName: FeatureName;
	className?: string;
	filterByVision?: boolean;
}

type ModelCategory = 'all' | 'coding' | 'reasoning' | 'vision' | 'audio' | 'video' | 'general';

/**
 * Modern model selector component with cards, filters, and search.
 * Maintains 100% compatibility with ModelDropdown props and functionality.
 */
export const ModernModelSelector = ({ featureName, className = '', filterByVision }: ModernModelSelectorProps) => {
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const settingsState = useSettingsState();

	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<ModelCategory>('all');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Get available models (same logic as MemoizedModelDropdown)
	const { filter, emptyMessage } = modelFilterOfFeatureName[featureName];

	const availableOptions = useMemo(() => {
		let options = settingsState._modelOptions.filter((o) => 
			filter(o.selection, { 
				chatMode: settingsState.globalSettings.chatMode, 
				overridesOfModel: settingsState.overridesOfModel 
			})
		);

		// Apply vision filter if enabled
		if (filterByVision) {
			options = options.filter((o) => {
				const capabilities = getModelCapabilities(o.selection.providerName, o.selection.modelName, settingsState.overridesOfModel);
				return capabilities.supportsVision === true;
			});
		}

		return options;
	}, [settingsState._modelOptions, filter, filterByVision, settingsState.globalSettings.chatMode, settingsState.overridesOfModel, featureName]);

	// Filter by search query and category
	const filteredOptions = useMemo(() => {
		let filtered = availableOptions;

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(option => 
				option.selection.modelName.toLowerCase().includes(query) ||
				option.selection.providerName.toLowerCase().includes(query) ||
				option.name.toLowerCase().includes(query)
			);
		}

		// Apply category filter
		if (selectedCategory !== 'all') {
			filtered = filtered.filter(option => {
				const capabilities = getModelCapabilities(
					option.selection.providerName,
					option.selection.modelName,
					settingsState.overridesOfModel
				);

				switch (selectedCategory) {
					case 'coding':
						return capabilities.supportsFIM === true;
					case 'reasoning':
						return capabilities.reasoningCapabilities !== false;
					case 'vision':
						return capabilities.supportsVision === true;
					case 'audio':
						return capabilities.supportsAudio === true;
					case 'video':
						return capabilities.supportsVideo === true;
					case 'general':
						return !capabilities.supportsFIM && 
							   capabilities.reasoningCapabilities === false &&
							   !capabilities.supportsVision &&
							   !capabilities.supportsAudio &&
							   !capabilities.supportsVideo;
					default:
						return true;
				}
			});
		}

		return filtered;
	}, [availableOptions, searchQuery, selectedCategory, settingsState.overridesOfModel]);

	// Get current selection
	const currentSelection = voidSettingsService.state.modelSelectionOfFeature[featureName];
	const selectedOption = currentSelection 
		? settingsState._modelOptions.find(v => modelSelectionsEqual(v.selection, currentSelection))
		: availableOptions[0];

	const handleSelectModel = useCallback((option: ModelOption) => {
		voidSettingsService.setModelSelectionOfFeature(featureName, option.selection);
		setIsDropdownOpen(false);
		setSearchQuery(''); // Clear search when selecting
	}, [voidSettingsService, featureName]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		};

		if (isDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [isDropdownOpen]);

	// Categories for filtering
	const categories: { id: ModelCategory; label: string; icon: typeof Search }[] = [
		{ id: 'all', label: 'All', icon: Search },
		{ id: 'coding', label: 'Coding', icon: Zap },
		{ id: 'reasoning', label: 'Reasoning', icon: Wrench },
		{ id: 'vision', label: 'Vision', icon: Eye },
		{ id: 'audio', label: 'Audio', icon: Mic },
		{ id: 'video', label: 'Video', icon: Video },
		{ id: 'general', label: 'General', icon: Search },
	];

	if (availableOptions.length === 0) {
		return (
			<div className={`text-void-fg-3 text-sm p-3 border border-void-border-2 rounded ${className}`}>
				{emptyMessage?.message || 'No models available'}
			</div>
		);
	}

	const getModelInfo = (option: ModelOption) => {
		const capabilities = getModelCapabilities(
			option.selection.providerName,
			option.selection.modelName,
			settingsState.overridesOfModel
		);

		return {
			contextWindow: capabilities.contextWindow,
			reservedOutputTokens: capabilities.reservedOutputTokenSpace ?? 4096,
			supportsVision: capabilities.supportsVision === true,
			supportsReasoning: capabilities.reasoningCapabilities !== false,
			supportsFIM: capabilities.supportsFIM === true,
			supportsAudio: capabilities.supportsAudio === true,
			supportsVideo: capabilities.supportsVideo === true,
			supportsTools: capabilities.supportsTools === true,
		};
	};

	return (
		<div ref={dropdownRef} className={`relative ${className}`}>
			{/* Main selector button */}
			<button
				type="button"
				onClick={() => setIsDropdownOpen(!isDropdownOpen)}
				className={`
					w-full flex items-center justify-between gap-2 px-3 py-2 
					bg-void-bg-1 border border-void-border-1 rounded 
					text-void-fg-1 hover:bg-void-bg-2 hover:border-void-border-2
					transition-colors text-left
				`}
			>
				<div className="flex-1 min-w-0">
					<div className="font-medium truncate">
						{selectedOption?.selection.modelName || 'Select a model'}
					</div>
					{selectedOption && (
						<div className="text-xs text-void-fg-3 truncate">
							{selectedOption.selection.providerName}
						</div>
					)}
				</div>
				<svg
					className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{/* Dropdown panel */}
			{isDropdownOpen && (
				<div className={`
					absolute z-50 w-full mt-1 bg-void-bg-1 border border-void-border-1 rounded shadow-lg
					max-h-[600px] overflow-hidden flex flex-col
				`}>
					{/* Search bar */}
					<div className="p-2 border-b border-void-border-1">
						<div className="relative">
							<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-void-fg-3" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search models..."
								className={`
									w-full pl-8 pr-8 py-2 bg-void-bg-2 border border-void-border-2 rounded
									text-void-fg-1 placeholder-void-fg-3
									focus:outline-none focus:border-void-border-3
								`}
								autoFocus
							/>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className="absolute right-2 top-1/2 transform -translate-y-1/2 text-void-fg-3 hover:text-void-fg-1"
								>
									<X className="w-4 h-4" />
								</button>
							)}
						</div>
					</div>

					{/* Category filters */}
					<div className="flex gap-1 p-2 border-b border-void-border-1 overflow-x-auto">
						{categories.map((category) => {
							const Icon = category.icon;
							return (
								<button
									key={category.id}
									type="button"
									onClick={() => setSelectedCategory(category.id)}
									className={`
										px-3 py-1 rounded text-xs font-medium whitespace-nowrap
										flex items-center gap-1 transition-colors
										${selectedCategory === category.id
											? 'bg-void-bg-3 text-void-fg-1'
											: 'bg-void-bg-2 text-void-fg-3 hover:bg-void-bg-3 hover:text-void-fg-2'
										}
									`}
								>
									<Icon className="w-3 h-3" />
									{category.label}
								</button>
							);
						})}
					</div>

					{/* Model list */}
					<div className="overflow-y-auto flex-1 p-2">
						{filteredOptions.length === 0 ? (
							<div className="text-center py-8 text-void-fg-3 text-sm">
								No models found matching your criteria
							</div>
						) : (
							<div className="grid grid-cols-1 gap-2">
								{filteredOptions.map((option) => {
									const isSelected = selectedOption && modelSelectionsEqual(option.selection, selectedOption.selection);
									const modelInfo = getModelInfo(option);

									return (
										<button
											key={`${option.selection.providerName}-${option.selection.modelName}`}
											type="button"
											onClick={() => handleSelectModel(option)}
											className={`
												p-3 rounded border text-left transition-all
												${isSelected
													? 'border-void-border-3 bg-void-bg-3 shadow-sm'
													: 'border-void-border-2 bg-void-bg-2 hover:border-void-border-3 hover:bg-void-bg-3'
												}
											`}
										>
											<div className="flex items-start justify-between gap-2">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<span className="font-medium text-void-fg-1 truncate">
															{option.selection.modelName}
														</span>
														{isSelected && (
															<Check className="w-4 h-4 text-void-fg-1 flex-shrink-0" />
														)}
													</div>
													<div className="text-xs text-void-fg-3 mb-2">
														{option.selection.providerName}
													</div>
													<div className="flex flex-wrap gap-2 text-xs">
														<span className="text-void-fg-3">
															{Math.round(modelInfo.contextWindow / 1000)}K context
														</span>
														{modelInfo.supportsReasoning && (
															<span className="px-1.5 py-0.5 bg-void-bg-3 rounded text-void-fg-2">
																Reasoning
															</span>
														)}
														{modelInfo.supportsVision && (
															<span className="px-1.5 py-0.5 bg-void-bg-3 rounded text-void-fg-2">
																Vision
															</span>
														)}
														{modelInfo.supportsFIM && (
															<span className="px-1.5 py-0.5 bg-void-bg-3 rounded text-void-fg-2">
																Coding
															</span>
														)}
														{modelInfo.supportsAudio && (
															<span className="px-1.5 py-0.5 bg-void-bg-3 rounded text-void-fg-2">
																Audio
															</span>
														)}
														{modelInfo.supportsVideo && (
															<span className="px-1.5 py-0.5 bg-void-bg-3 rounded text-void-fg-2">
																Video
															</span>
														)}
													</div>
												</div>
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* Results count */}
					{filteredOptions.length > 0 && (
						<div className="px-3 py-2 border-t border-void-border-1 text-xs text-void-fg-3 text-center">
							{filteredOptions.length} {filteredOptions.length === 1 ? 'model' : 'models'}
							{availableOptions.length !== filteredOptions.length && ` of ${availableOptions.length}`}
						</div>
					)}
				</div>
			)}
		</div>
	);
};


