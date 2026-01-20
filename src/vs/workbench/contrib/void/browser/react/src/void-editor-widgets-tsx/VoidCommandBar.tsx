/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useAccessor, useCommandBarState, useIsDark } from '../util/services.js';
import '../styles.css';
import { VoidCommandBarProps } from '../../../voidCommandBarService.js';
import { Check, EllipsisVertical, MoveDown, MoveLeft, MoveRight, MoveUp, X } from 'lucide-react';
import {
	VOID_GOTO_NEXT_DIFF_ACTION_ID,
	VOID_GOTO_PREV_DIFF_ACTION_ID,
	VOID_GOTO_NEXT_URI_ACTION_ID,
	VOID_GOTO_PREV_URI_ACTION_ID,
	VOID_ACCEPT_FILE_ACTION_ID,
	VOID_REJECT_FILE_ACTION_ID,
	VOID_ACCEPT_ALL_DIFFS_ACTION_ID,
	VOID_REJECT_ALL_DIFFS_ACTION_ID
} from '../../../actionIDs.js';

export const VoidCommandBarMain = ({ uri, editor }: VoidCommandBarProps) => {
	const isDark = useIsDark();
	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
			<VoidCommandBar uri={uri} editor={editor} />
		</div>
	);
};

export const AcceptAllButtonWrapper = ({ text, onClick, className, ...props }: { text: string, onClick: () => void, className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
	<button
		className={`
			px-3 py-1
			flex items-center gap-1.5
			text-[10px] text-nowrap font-medium
			h-full rounded
			cursor-pointer
			transition-all duration-300
			hover:scale-105
			neon-green glass-button
			${className}
		`}
		style={{
			background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0.2) 100%)',
			border: '1px solid rgba(16, 185, 129, 0.5)',
			backdropFilter: 'blur(8px)',
			color: '#10B981',
			textShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
		}}
		type='button'
		onClick={onClick}
		{...props}
	>
		<Check size={14} />
		<span>{text}</span>
	</button>
);

export const RejectAllButtonWrapper = ({ text, onClick, className, ...props }: { text: string, onClick: () => void, className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
	<button
		className={`
			px-3 py-1
			flex items-center gap-1.5
			text-[10px] text-nowrap font-medium
			h-full rounded
			cursor-pointer
			transition-all duration-300
			hover:scale-105
			neon-red glass-button
			${className}
		`}
		style={{
			background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.2) 100%)',
			border: '1px solid rgba(239, 68, 68, 0.5)',
			backdropFilter: 'blur(8px)',
			color: '#EF4444',
			textShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
		}}
		type='button'
		onClick={onClick}
		{...props}
	>
		<X size={14} />
		<span>{text}</span>
	</button>
);

export const VoidCommandBar = ({ uri, editor }: VoidCommandBarProps) => {
	const accessor = useAccessor();
	const editCodeService = accessor.get('IEditCodeService');
	const commandBarService = accessor.get('IVoidCommandBarService');
	const metricsService = accessor.get('IMetricsService');
	const keybindingService = accessor.get('IKeybindingService');
	const { stateOfURI: commandBarState, sortedURIs: sortedCommandBarURIs } = useCommandBarState();
	const [showAcceptRejectAllButtons, setShowAcceptRejectAllButtons] = useState(false);
	const _latestValidUriIdxRef = useRef<number | null>(null);

	const i_ = sortedCommandBarURIs.findIndex(e => e.fsPath === uri?.fsPath);
	const currFileIdx = i_ === -1 ? null : i_;

	useEffect(() => {
		if (currFileIdx !== null) _latestValidUriIdxRef.current = currFileIdx;
	}, [currFileIdx]);

	const uriIdxInStepper = currFileIdx !== null ? currFileIdx : _latestValidUriIdxRef.current === null ? null : _latestValidUriIdxRef.current < sortedCommandBarURIs.length ? _latestValidUriIdxRef.current : null;

	useEffect(() => {
		setTimeout(() => {
			if (!uri) return;
			const s = commandBarService.stateOfURI[uri.fsPath];
			if (!s) return;
			const { diffIdx } = s;
			commandBarService.goToDiffIdx(diffIdx ?? 0);
		}, 50);
	}, [uri, commandBarService]);

	if (uri?.scheme !== 'file') return null;
	if (sortedCommandBarURIs.length === 0) return null;

	const currDiffIdx = uri ? commandBarState[uri.fsPath]?.diffIdx ?? null : null;
	const sortedDiffIds = uri ? commandBarState[uri.fsPath]?.sortedDiffIds ?? [] : [];
	const sortedDiffZoneIds = uri ? commandBarState[uri.fsPath]?.sortedDiffZoneIds ?? [] : [];

	const isADiffInThisFile = sortedDiffIds.length !== 0;
	const streamState = uri ? commandBarService.getStreamState(uri) : null;
	const showAcceptRejectAll = streamState === 'idle-has-changes';

	const nextDiffIdx = commandBarService.getNextDiffIdx(1);
	const prevDiffIdx = commandBarService.getNextDiffIdx(-1);
	const nextURIIdx = commandBarService.getNextUriIdx(1);
	const prevURIIdx = commandBarService.getNextUriIdx(-1);

	const upDownDisabled = prevDiffIdx === null || nextDiffIdx === null;
	const leftRightDisabled = prevURIIdx === null || nextURIIdx === null;

	const onAcceptFile = () => {
		if (!uri) return;
		editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior: 'accept', removeCtrlKs: false, _addToHistory: true });
		metricsService.capture('Accept File', {});
	};

	const onRejectFile = () => {
		if (!uri) return;
		editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior: 'reject', removeCtrlKs: false, _addToHistory: true });
		metricsService.capture('Reject File', {});
	};

	const onAcceptAll = () => {
		commandBarService.acceptOrRejectAllFiles({ behavior: 'accept' });
		metricsService.capture('Accept All', {});
		setShowAcceptRejectAllButtons(false);
	};

	const onRejectAll = () => {
		commandBarService.acceptOrRejectAllFiles({ behavior: 'reject' });
		metricsService.capture('Reject All', {});
		setShowAcceptRejectAllButtons(false);
	};

	const _upKeybinding = keybindingService.lookupKeybinding(VOID_GOTO_PREV_DIFF_ACTION_ID);
	const _downKeybinding = keybindingService.lookupKeybinding(VOID_GOTO_NEXT_DIFF_ACTION_ID);
	const _leftKeybinding = keybindingService.lookupKeybinding(VOID_GOTO_PREV_URI_ACTION_ID);
	const _rightKeybinding = keybindingService.lookupKeybinding(VOID_GOTO_NEXT_URI_ACTION_ID);
	const _acceptFileKeybinding = keybindingService.lookupKeybinding(VOID_ACCEPT_FILE_ACTION_ID);
	const _rejectFileKeybinding = keybindingService.lookupKeybinding(VOID_REJECT_FILE_ACTION_ID);
	const acceptFileKeybindLabel = editCodeService.processRawKeybindingText(_acceptFileKeybinding?.getAriaLabel() || '');
	const rejectFileKeybindLabel = editCodeService.processRawKeybindingText(_rejectFileKeybinding?.getAriaLabel() || '');

	if (currFileIdx === null) {
		return (
			<div className="pointer-events-auto">
				<div className="flex bg-void-bg-2/80 backdrop-blur-sm rounded-lg border border-void-border-1/30 [&>*:first-child]:pl-3 [&>*:last-child]:pr-3 [&>*]:border-r [&>*]:border-void-border-1/20 [&>*:last-child]:border-r-0">
					<div className="flex items-center px-3">
						<span className="text-xs whitespace-nowrap text-void-fg-2/80">
							{`${sortedCommandBarURIs.length} file${sortedCommandBarURIs.length === 1 ? '' : 's'} changed`}
						</span>
					</div>
					<button
						className="text-xs whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 px-3 py-1.5 rounded glass-icon-button transition-all"
						style={{
							background: 'rgba(0, 127, 212, 0.2)',
							border: '1px solid rgba(0, 127, 212, 0.3)',
							color: '#10B981',
						}}
						onClick={() => commandBarService.goToURIIdx(nextURIIdx)}
					>
						Next <MoveRight className='size-3' />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="pointer-events-auto">
			{showAcceptRejectAllButtons && showAcceptRejectAll && (
				<div className="flex justify-end mb-1">
					<div className="inline-flex bg-void-bg-2/80 backdrop-blur-sm rounded-lg shadow-md border border-void-border-1/30 overflow-hidden">
						<div className="flex items-center [&>*]:border-r [&>*]:border-void-border-1/20 [&>*:last-child]:border-r-0">
							<AcceptAllButtonWrapper text={`Accept All`} onClick={onAcceptAll} />
							<RejectAllButtonWrapper text={`Reject All`} onClick={onRejectAll} />
						</div>
					</div>
				</div>
			)}

			<div className="flex items-center bg-void-bg-2/80 backdrop-blur-sm rounded-lg shadow-md border border-void-border-1/30 [&>*:first-child]:pl-3 [&>*:last-child]:pr-3 [&>*]:px-3 [&>*]:border-r [&>*]:border-void-border-1/20 [&>*:last-child]:border-r-0">
				{/* Diff Navigation */}
				<div className="flex items-center py-0.5">
					<button className="cursor-pointer p-1 rounded glass-icon-button" disabled={upDownDisabled} onClick={() => commandBarService.goToDiffIdx(prevDiffIdx)}>
						<MoveUp className='size-3 transition-all duration-200 text-void-fg-2' />
					</button>
					<span className={`text-xs whitespace-nowrap px-1 ${!isADiffInThisFile ? 'opacity-70' : ''}`}>
						{isADiffInThisFile ? `Diff ${(currDiffIdx ?? 0) + 1} of ${sortedDiffIds.length}` : (streamState === 'streaming' ? 'No changes yet' : 'No changes')}
					</span>
					<button className="cursor-pointer p-1 rounded glass-icon-button" disabled={upDownDisabled} onClick={() => commandBarService.goToDiffIdx(nextDiffIdx)}>
						<MoveDown className='size-3 transition-all duration-200 text-void-fg-2' />
					</button>
				</div>

				{/* File Navigation */}
				<div className="flex items-center py-0.5">
					<button className="cursor-pointer p-1 rounded glass-icon-button" disabled={leftRightDisabled} onClick={() => commandBarService.goToURIIdx(prevURIIdx)}>
						<MoveLeft className='size-3 transition-all duration-200 text-void-fg-2' />
					</button>
					<span className="text-xs whitespace-nowrap px-1 mx-0.5">
						{`File ${currFileIdx + 1} of ${sortedCommandBarURIs.length}`}
					</span>
					<button className="cursor-pointer p-1 rounded glass-icon-button" disabled={leftRightDisabled} onClick={() => commandBarService.goToURIIdx(nextURIIdx)}>
						<MoveRight className='size-3 transition-all duration-200 text-void-fg-2' />
					</button>
				</div>

				{/* Accept/Reject Buttons */}
				{showAcceptRejectAll && (
					<div className='flex self-stretch gap-0 !px-0 !py-0'>
						<AcceptAllButtonWrapper text={`Accept`} onClick={onAcceptFile} />
						<RejectAllButtonWrapper text={`Reject`} onClick={onRejectFile} />
					</div>
				)}
				{showAcceptRejectAll && (
					<div className='!px-0 !py-0 self-stretch flex justify-center items-center'>
						<div className="cursor-pointer px-1 self-stretch flex justify-center items-center" onClick={() => setShowAcceptRejectAllButtons(!showAcceptRejectAllButtons)}>
							<EllipsisVertical className="size-3" />
						</div>
					</div>
				)}
			</div>
		</div>
	);
};