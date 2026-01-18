import { CancellationToken } from '../../../../base/common/cancellation.js'
import { URI } from '../../../../base/common/uri.js'
import { VSBuffer } from '../../../../base/common/buffer.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js'
import { ISearchService } from '../../../services/search/common/search.js'
import { IEditCodeService } from './editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { LintErrorItem, BuiltinToolCallParams, BuiltinToolResultType, BuiltinToolName, ToolName } from '../common/toolsServiceTypes.js'
import { IVoidModelService } from '../common/voidModelService.js'
import { EndOfLinePreference } from '../../../../editor/common/model.js'
import { IVoidCommandBarService } from './voidCommandBarService.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js'
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js'
import { timeout } from '../../../../base/common/async.js'
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js'
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from '../common/prompt/prompts.js'
import { IVoidSettingsService } from '../common/voidSettingsService.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { ISharedBrowserService } from '../common/sharedBrowserService.js'
import { ToolMessage } from '../common/chatThreadServiceTypes.js'
import { ILogService } from '../../../../platform/log/common/log.js'
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js'
import { ISharedBrowserMainService } from '../electron-main/sharedBrowserMainService.js'
import { BrowserAction, SharedBrowserChannelClient } from '../electron-main/sharedBrowserChannel.js'


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] }
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


// We are NOT checking to make sure in workspace
const validateURI = (uriStr: unknown) => {
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	// Look for :// pattern which indicates a scheme is present
	// Examples of supported URIs:
	// - vscode-remote://wsl+Ubuntu/home/user/file.txt (WSL)
	// - vscode-remote://ssh-remote+myserver/home/user/file.txt (SSH)
	// - file:///home/user/file.txt (local file with scheme)
	// - /home/user/file.txt (local file path, will be converted to file://)
	// - C:\Users\file.txt (Windows local path, will be converted to file://)
	if (uriStr.includes('://')) {
		try {
			const uri = URI.parse(uriStr)
			return uri
		} catch (e) {
			// If parsing fails, it's a malformed URI
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	} else {
		// No scheme present, treat as file path
		// This handles regular file paths like /home/user/file.txt or C:\Users\file.txt
		const uri = URI.file(uriStr)
		return uri
	}
}

const validateOptionalURI = (uriStr: unknown) => {
	if (isFalsy(uriStr)) return null
	return validateURI(uriStr)
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}


const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) return 1
	const parsedInt = Number.parseInt(pageNumberUnknown + '')
	if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`)
	if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`)
	return parsedInt
}

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number')
		return numStr
	if (isFalsy(numStr)) return opts.default

	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '')
		if (!Number.isInteger(parsedInt)) return opts.default
		return parsedInt
	}

	return opts.default
}

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (!terminalIdUnknown) throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`)
	const terminalId = terminalIdUnknown + ''
	return terminalId
}

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') {
		return b
	}
	return opts.default
}


const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) return true
	return false
}

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
	notifyBrowserToolCall(toolName: string, rawParams: RawToolParamsObj, result?: any, mcpServerName?: string): Promise<void>;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	private sharedBrowserMainService: ISharedBrowserMainService | null = null;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IVoidModelService voidModelService: IVoidModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidCommandBarService private readonly commandBarService: IVoidCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@ISharedBrowserService private readonly sharedBrowserService: ISharedBrowserService,
		@ILogService private readonly logService: ILogService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		// Initialize shared browser main service client
		try {
			const channel = this.mainProcessService.getChannel('void-channel-sharedBrowser');
			this.sharedBrowserMainService = new SharedBrowserChannelClient(channel);
		} catch (error) {
			this.logService.warn('[ToolsService] Failed to initialize SharedBrowserMainService client:', error);
		}

		this.validateParams = {
			read_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)

				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })

				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null

				return { uri, startLine, endLine, pageNumber }
			},
			ls_dir: (params: RawToolParamsObj) => {
				const { uri: uriStr, page_number: pageNumberUnknown } = params

				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: (params: RawToolParamsObj) => {
				const { uri: uriStr, } = params
				const uri = validateURI(uriStr)
				return { uri }
			},
			search_pathnames_only: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: includeUnknown,
					page_number: pageNumberUnknown
				} = params

				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)

				return { query: queryStr, includePattern, pageNumber }

			},
			search_for_files: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: searchInFolderUnknown,
					is_regex: isRegexUnknown,
					page_number: pageNumberUnknown
				} = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = validateOptionalURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return {
					query: queryStr,
					isRegex,
					searchInFolder,
					pageNumber
				}
			},
			search_in_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = validateURI(uriStr);
				const query = validateStr('query', queryUnknown);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query, isRegex };
			},

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params
				const uri = validateURI(uriUnknown)
				return { uri }
			},

			// ---

			create_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown } = params
				const uri = validateURI(uriUnknown)
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isFolder }
			},

			delete_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params
				const uri = validateURI(uriUnknown)
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false })
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isRecursive, isFolder }
			},

			rewrite_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, new_content: newContentUnknown } = params
				const uri = validateURI(uriStr)
				const newContent = validateStr('newContent', newContentUnknown)
				return { uri, newContent }
			},

			edit_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				const uri = validateURI(uriStr)
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown)
				return { uri, searchReplaceBlocks }
			},

			// ---

			run_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				const terminalId = generateUuid()
				return { command, cwd, terminalId }
			},
			run_persistent_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown);
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown)
				return { command, persistentTerminalId };
			},
			open_persistent_terminal: (params: RawToolParamsObj) => {
				const { cwd: cwdUnknown } = params;
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				// No parameters needed; will open a new background terminal
				return { cwd };
			},
			kill_persistent_terminal: (params: RawToolParamsObj) => {
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},

			// --- Browser tools validators ---
			browser_navigate: (params: RawToolParamsObj) => {
				const { url: urlUnknown } = params;
				const url = validateStr('url', urlUnknown);
				return { url };
			},
			browser_click: (params: RawToolParamsObj) => {
				const { element: elementUnknown, ref: refUnknown } = params;
				const element = validateStr('element', elementUnknown);
				const ref = validateStr('ref', refUnknown);
				return { element, ref };
			},
			browser_type: (params: RawToolParamsObj) => {
				const { element: elementUnknown, ref: refUnknown, text: textUnknown, submit: submitUnknown } = params;
				const element = validateStr('element', elementUnknown);
				const ref = validateStr('ref', refUnknown);
				const text = validateStr('text', textUnknown);
				const submit = validateBoolean(submitUnknown, { default: false });
				return { element, ref, text, submit };
			},
			browser_snapshot: (_params: RawToolParamsObj) => {
				return {};
			},
			browser_screenshot: (params: RawToolParamsObj) => {
				const { full_page: fullPageUnknown } = params;
				const fullPage = validateBoolean(fullPageUnknown, { default: false });
				return { fullPage };
			},
			browser_hover: (params: RawToolParamsObj) => {
				const { element: elementUnknown, ref: refUnknown } = params;
				const element = validateStr('element', elementUnknown);
				const ref = validateStr('ref', refUnknown);
				return { element, ref };
			},
			browser_press_key: (params: RawToolParamsObj) => {
				const { key: keyUnknown } = params;
				const key = validateStr('key', keyUnknown);
				return { key };
			},
			browser_select_option: (params: RawToolParamsObj) => {
				const { element: elementUnknown, ref: refUnknown, values: valuesUnknown } = params;
				const element = validateStr('element', elementUnknown);
				const ref = validateStr('ref', refUnknown);
				let values: string[] = [];
				if (Array.isArray(valuesUnknown)) {
					values = valuesUnknown.map(v => String(v));
				} else if (valuesUnknown) {
					values = [String(valuesUnknown)];
				}
				return { element, ref, values };
			},
			browser_wait_for: (params: RawToolParamsObj) => {
				const { text: textUnknown, text_gone: textGoneUnknown, time: timeUnknown } = params;
				const text = validateOptionalStr('text', textUnknown) ?? undefined;
				const textGone = validateOptionalStr('text_gone', textGoneUnknown) ?? undefined;
				const time = validateNumber(timeUnknown, { default: null }) ?? undefined;
				return { text, textGone, time };
			},

		}


		this.callTool = {
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				await voidModelService.initializeModel(uri)
				const { model } = await voidModelService.getModelSafe(uri)
				if (model === null) { throw new Error(`No contents; File does not exist.`) }

				let contents: string
				if (startLine === null && endLine === null) {
					contents = model.getValue(EndOfLinePreference.LF)
				}
				else {
					const startLineNumber = startLine === null ? 1 : startLine
					const endLineNumber = endLine === null ? model.getLineCount() : endLine
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
				}

				const totalNumLines = model.getLineCount()

				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1)
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1
				const fileContents = contents.slice(fromIdx, toIdx + 1) // paginate
				const hasNextPage = (contents.length - 1) - toIdx >= 1
				const totalFileLen = contents.length
				return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } }
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {

				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
					filePattern: queryStr,
					includePattern: includePattern ?? undefined,
					sortByScore: true, // makes results 10x better
				})
				const data = await searchService.fileSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { uris, hasNextPage } }
			},

			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ?
					workspaceContextService.getWorkspace().folders.map(f => f.uri)
					: [searchInFolder]

				const query = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders)

				const data = await searchService.textSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { queryStr, uris, hasNextPage } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) { throw new Error(`No contents; File does not exist.`); }
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			// ---

			create_file_or_folder: async ({ uri, isFolder }) => {
				if (isFolder)
					await fileService.createFolder(uri)
				else {
					await fileService.createFile(uri)
				}
				return { result: {} }
			},

			delete_file_or_folder: async ({ uri, isRecursive }) => {
				await fileService.del(uri, { recursive: isRecursive })
				return { result: {} }
			},

			rewrite_file: async ({ uri, newContent }) => {
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyRewriteFile({ uri, newContent })
				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})
				return { result: lintErrorsPromise }
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks })

				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})

				return { result: lintErrorsPromise }
			},
			// ---
			run_command: async ({ command, cwd, terminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			open_persistent_terminal: async ({ cwd }) => {
				const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd })
				return { result: { persistentTerminalId } }
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				// Close the background terminal by sending exit
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
				return { result: {} }
			},

			// --- Browser tools handlers ---
			browser_navigate: async ({ url }) => {
				try {
					// Open browser if not already open
					await this.sharedBrowserService.open();
					if (!this.sharedBrowserMainService) {
						throw new Error('Browser main service not available');
					}
					await this.sharedBrowserMainService.navigate(url);
					return { result: { success: true, url } };
				} catch (error) {
					this.logService.error(`[ToolsService] browser_navigate error: ${error}`);
					return { result: { success: false, url, error: String(error) } };
				}
			},
			browser_click: async ({ element, ref }) => {
				await this.sharedBrowserService.open();
				if (this.sharedBrowserMainService) {
					await this.sharedBrowserMainService.executeAction({
						type: 'click',
						element,
						ref,
						timestamp: Date.now(),
						description: `Click on ${element}`,
					});
					return { result: { success: true } };
				}
				return { result: { success: false } };
			},
			browser_type: async ({ element, ref, text, submit }) => {
				await this.sharedBrowserService.open();
				if (this.sharedBrowserMainService) {
					await this.sharedBrowserMainService.executeAction({
						type: 'type',
						element,
						ref,
						text,
						timestamp: Date.now(),
						description: `Type "${text}" into ${element}`,
					});
					if (submit) {
						await this.sharedBrowserMainService.executeAction({
							type: 'press_key',
							key: 'Enter',
							timestamp: Date.now(),
							description: 'Press Enter to submit',
						});
					}
					return { result: { success: true } };
				}
				return { result: { success: false } };
			},
			browser_snapshot: async () => {
				try {
					await this.sharedBrowserService.open();
					if (!this.sharedBrowserMainService) {
						throw new Error('Browser main service not available');
					}
					const snapshot = await this.sharedBrowserMainService.captureSnapshot();
					if (!snapshot) {
						// If no snapshot, wait a bit and try again
						await timeout(500);
						const state = await this.sharedBrowserMainService.getState();
						return { result: { snapshot: state.currentSnapshot || null } };
					}
					return { result: { snapshot } };
				} catch (error) {
					this.logService.error(`[ToolsService] browser_snapshot error: ${error}`);
					return { result: { snapshot: null } };
				}
			},
			browser_screenshot: async ({ fullPage }) => {
				try {
					await this.sharedBrowserService.open();
					if (!this.sharedBrowserMainService) {
						throw new Error('Browser main service not available');
					}
					// Always capture a fresh screenshot
					const screenshot = await this.sharedBrowserMainService.captureSnapshot();
					if (!screenshot) {
						// If no screenshot, wait a bit and try again
						await timeout(500);
						const state = await this.sharedBrowserMainService.getState();
						return { result: { screenshot: state.currentSnapshot || null } };
					}
					// Save screenshot as file (fire and forget)
					this.saveScreenshotToFile(screenshot).catch(err => {
						this.logService.warn(`[ToolsService] Failed to save screenshot file: ${err}`);
					});
					return { result: { screenshot } };
				} catch (error) {
					this.logService.error(`[ToolsService] browser_screenshot error: ${error}`);
					return { result: { screenshot: null } };
				}
			},
			browser_hover: async ({ element, ref }) => {
				await this.sharedBrowserService.open();
				if (this.sharedBrowserMainService) {
					await this.sharedBrowserMainService.executeAction({
						type: 'hover',
						element,
						ref,
						timestamp: Date.now(),
						description: `Hover over ${element}`,
					});
					return { result: { success: true } };
				}
				return { result: { success: false } };
			},
			browser_press_key: async ({ key }) => {
				await this.sharedBrowserService.open();
				if (this.sharedBrowserMainService) {
					await this.sharedBrowserMainService.executeAction({
						type: 'press_key',
						key,
						timestamp: Date.now(),
						description: `Press key ${key}`,
					});
					return { result: { success: true } };
				}
				return { result: { success: false } };
			},
			browser_select_option: async ({ element, ref, values }) => {
				await this.sharedBrowserService.open();
				if (this.sharedBrowserMainService) {
					await this.sharedBrowserMainService.executeAction({
						type: 'select_option',
						element,
						ref,
						values,
						timestamp: Date.now(),
						description: `Select option in ${element}`,
					});
					return { result: { success: true } };
				}
				return { result: { success: false } };
			},
			browser_wait_for: async ({ text, textGone, time }) => {
				await this.sharedBrowserService.open();
				if (this.sharedBrowserMainService) {
					await this.sharedBrowserMainService.executeAction({
						type: 'wait_for',
						text,
						textGone,
						time,
						timestamp: Date.now(),
						description: text ? `Wait for "${text}"` : textGone ? `Wait for "${textGone}" to disappear` : `Wait ${time}s`,
					});
					return { result: { success: true } };
				}
				return { result: { success: false } };
			},
		}


		const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(more on next page...)' : ''

		const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
			return lintErrors
				.map((e, i) => `Error ${i + 1}:\nLines Affected: ${e.startLineNumber}-${e.endLineNumber}\nError message:${e.message}`)
				.join('\n\n')
				.substring(0, MAX_FILE_CHARS_PAGE)
		}

		// given to the LLM after the call for successful tool calls
		this.stringOfResult = {
			read_file: (params, result) => {
				return `${params.uri.fsPath}\n\`\`\`\n${result.fileContents}\n\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `\nMore info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ''}`
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			// ---
			create_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully created.`
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				// success
				if (resolveReason.type === 'done') {
					let feedback = `${result_}\n(exit code ${resolveReason.exitCode})`
					if (resolveReason.exitCode !== 0) {
						feedback += `\n\nTIP: The command failed. Analyze the output for error messages. If a file is missing, use ls_dir to check the path. If a port is in use, use netstat or lsof to find the process.`
					}
					return feedback
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. If this is a long-running process like a server, use open_persistent_terminal instead.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				const { persistentTerminalId } = params
				// success
				if (resolveReason.type === 'done') {
					let feedback = `${result_}\n(exit code ${resolveReason.exitCode})`
					if (resolveReason.exitCode !== 0) {
						feedback += `\n\nTIP: The persistent command failed. You might want to check the terminal logs or try a different command.`
					}
					return feedback
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds. You can use read_terminal later to check its progress.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},
			// --- Browser tools result strings ---
			browser_navigate: (params, result) => {
				return result.success ? `Successfully navigated to ${params.url}` : `Failed to navigate to ${params.url}`;
			},
			browser_click: (params, result) => {
				return result.success ? `Successfully clicked on "${params.element}"` : `Failed to click on "${params.element}"`;
			},
			browser_type: (params, result) => {
				return result.success ? `Successfully typed into "${params.element}"` : `Failed to type into "${params.element}"`;
			},
			browser_snapshot: (_params, result) => {
				if (result.snapshot) {
					// Retorna o conteúdo completo do snapshot para o agente poder identificar elementos
					const snapshotText = typeof result.snapshot === 'string' 
						? result.snapshot 
						: JSON.stringify(result.snapshot, null, 2);
					
					// Limita o tamanho do snapshot para evitar exceder o contexto
					const MAX_SNAPSHOT_LENGTH = 50000; // ~50k caracteres
					const truncatedSnapshot = snapshotText.length > MAX_SNAPSHOT_LENGTH
						? snapshotText.substring(0, MAX_SNAPSHOT_LENGTH) + '\n\n[... snapshot truncated ...]'
						: snapshotText;
					
					return `Snapshot captured. Here is the accessibility tree with element references (use the 'ref' field to identify elements for clicking):\n\n${truncatedSnapshot}`;
				}
				return `Failed to capture snapshot.`;
			},
			browser_screenshot: (_params, result) => {
				return result.screenshot ? `Screenshot captured successfully (${result.screenshot.length} bytes).` : `Failed to capture screenshot.`;
			},
			browser_hover: (params, result) => {
				return result.success ? `Successfully hovered over "${params.element}"` : `Failed to hover over "${params.element}"`;
			},
			browser_press_key: (params, result) => {
				return result.success ? `Successfully pressed key "${params.key}"` : `Failed to press key "${params.key}"`;
			},
			browser_select_option: (params, result) => {
				return result.success ? `Successfully selected option in "${params.element}"` : `Failed to select option in "${params.element}"`;
			},
			browser_wait_for: (_params, result) => {
				return result.success ? `Wait completed successfully.` : `Wait failed.`;
			},
		}



	}


	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))

		if (!lintErrors.length) return { lintErrors: null }
		return { lintErrors, }
	}

	/**
	 * Monitora chamadas de ferramentas MCP do navegador e notifica o SharedBrowserService
	 * Este método deve ser chamado quando uma ferramenta MCP é executada para detectar
	 * se é uma ferramenta do navegador (mcp_cursor-ide-browser_*)
	 */
	async notifyBrowserToolCall(
		toolName: string,
		rawParams: RawToolParamsObj,
		result?: any,
		mcpServerName?: string
	): Promise<void> {
		// Verifica se é uma ferramenta do navegador
		if (!toolName.startsWith('mcp_cursor-ide-browser_')) {
			return;
		}

		try {
			// Verifica se navegador está ativo e modo de controle
			const browserState = this.sharedBrowserService.state;
			if (!browserState.isActive) {
				// Auto-abrir se não estiver ativo
				await this.sharedBrowserService.open();
			}

			// Se controle está no agente, executar ação real via IPC
			if (browserState.controlMode === 'agent' && this.sharedBrowserMainService) {
				try {
					// Converter tool call para BrowserAction
					const action: BrowserAction = this._convertToolCallToBrowserAction(toolName, rawParams);
					
					// Executar ação real no main process
					await this.sharedBrowserMainService.executeAction(action);
					
					// Capturar snapshot após ação
					await this.sharedBrowserMainService.captureSnapshot();
				} catch (error) {
					this.logService.error(`[ToolsService] Failed to execute browser action via IPC: ${error}`);
				}
			}

			// Cria um ToolMessage compatível com o formato esperado pelo SharedBrowserService
			const toolMessage: ToolMessage<ToolName> = {
				role: 'tool',
				type: result !== undefined ? 'success' : 'running_now',
				name: toolName as any,
				params: rawParams as any,
				result: result !== undefined ? result : null,
				content: result !== undefined ? (typeof result === 'string' ? result : JSON.stringify(result)) : '(value not received yet...)',
				id: generateUuid(),
				rawParams,
				mcpServerName,
			};

			// Notifica o SharedBrowserService (atualiza estado e histórico)
			await this.sharedBrowserService.handleBrowserToolCall(toolMessage);
		} catch (error) {
			// Log do erro mas não interrompe o fluxo
			this.logService.error(`[ToolsService] Failed to notify SharedBrowserService about browser tool call: ${error}`);
		}
	}

	/**
	 * Save a base64 screenshot to workspace folder
	 */
	private async saveScreenshotToFile(base64Data: string): Promise<void> {
		try {
			const workspace = this.workspaceContextService.getWorkspace();
			if (!workspace.folders || workspace.folders.length === 0) {
				this.logService.info('[ToolsService] No workspace folder, skipping screenshot save');
				return;
			}
			
			const timestamp = Date.now();
			const filename = `void_screenshot_${timestamp}.png`;
			const workspaceRoot = workspace.folders[0].uri;
			const screenshotsDir = URI.joinPath(workspaceRoot, '.void', 'screenshots');
			const filePath = URI.joinPath(screenshotsDir, filename);
			
			// Remove data:image/png;base64, prefix if present
			const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
			
			// Convert base64 to binary buffer
			const binaryData = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
			
			// Write to file
			await this.fileService.writeFile(filePath, VSBuffer.wrap(binaryData));
			
			this.logService.info(`[ToolsService] Screenshot saved to: ${filePath.fsPath}`);
		} catch (error) {
			this.logService.warn(`[ToolsService] Failed to save screenshot file (non-critical): ${error}`);
		}
	}

	private _convertToolCallToBrowserAction(toolName: string, rawParams: RawToolParamsObj): BrowserAction {
		const baseAction: BrowserAction = {
			type: 'navigate',
			timestamp: Date.now(),
			description: '',
		};

		if (toolName === 'mcp_cursor-ide-browser_browser_navigate') {
			return {
				...baseAction,
				type: 'navigate',
				url: rawParams.url as string,
				description: `Navigate to ${rawParams.url}`,
			};
		} else if (toolName === 'mcp_cursor-ide-browser_browser_click') {
			return {
				...baseAction,
				type: 'click',
				ref: rawParams.ref as string,
				element: rawParams.element as string,
				description: `Click on element: ${rawParams.element || rawParams.ref || 'unknown'}`,
			};
		} else if (toolName === 'mcp_cursor-ide-browser_browser_type') {
			return {
				...baseAction,
				type: 'type',
				ref: rawParams.ref as string,
				element: rawParams.element as string,
				text: rawParams.text as string,
				description: `Type "${rawParams.text}" into element: ${rawParams.element || 'unknown'}`,
			};
		} else if (toolName === 'mcp_cursor-ide-browser_browser_hover') {
			return {
				...baseAction,
				type: 'hover',
				ref: rawParams.ref as string,
				element: rawParams.element as string,
				description: `Hover over element: ${rawParams.element || 'unknown'}`,
			};
		} else if (toolName === 'mcp_cursor-ide-browser_browser_press_key') {
			return {
				...baseAction,
				type: 'press_key',
				key: rawParams.key as string,
				description: `Press key: ${rawParams.key}`,
			};
		} else if (toolName === 'mcp_cursor-ide-browser_browser_select_option') {
			let values: string[] = [];
			if (Array.isArray(rawParams.values)) {
				values = rawParams.values as string[];
			} else if (rawParams.values && typeof rawParams.values === 'string') {
				values = [rawParams.values];
			}
			return {
				...baseAction,
				type: 'select_option',
				ref: rawParams.ref as string,
				element: rawParams.element as string,
				values,
				description: `Select option in element: ${rawParams.element || 'unknown'}`,
			};
		} else if (toolName === 'mcp_cursor-ide-browser_browser_wait_for') {
			let time: number | undefined = undefined;
			if (typeof rawParams.time === 'number') {
				time = rawParams.time;
			} else if (rawParams.time && typeof rawParams.time === 'string') {
				const parsed = Number(rawParams.time);
				if (!isNaN(parsed)) {
					time = parsed;
				}
			}
			return {
				...baseAction,
				type: 'wait_for',
				time,
				text: rawParams.text as string | undefined,
				textGone: rawParams.textGone as string | undefined,
				description: time ? `Wait for ${time} seconds` : `Wait for text: ${rawParams.text || 'unknown'}`,
			};
		}

		// Default to navigate
		return baseAction;
	}

}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
