import { Disposable } from '../../../../base/common/lifecycle.js';
import { deepClone } from '../../../../base/common/objects.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ChatMessage } from '../common/chatThreadServiceTypes.js';
import { getIsReasoningEnabledState, getReservedOutputTokenSpace, getModelCapabilities } from '../common/modelCapabilities.js';
import { reParsedToolXMLString, chat_systemMessage } from '../common/prompt/prompts.js';
import { AnthropicLLMChatMessage, AnthropicReasoning, GeminiLLMChatMessage, LLMChatMessage, LLMFIMMessage, OpenAILLMChatMessage, RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ChatMode, FeatureName, ModelSelection, ProviderName } from '../common/voidSettingsTypes.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';
import { ITerminalToolService } from './terminalToolService.js';
import { IVoidModelService } from '../common/voidModelService.js';
import { URI } from '../../../../base/common/uri.js';
import { EndOfLinePreference } from '../../../../editor/common/model.js';
import { ToolName } from '../common/toolsServiceTypes.js';
import { IMCPService } from '../common/mcpService.js';
import { InternalToolInfo } from '../common/prompt/prompts.js';

export const EMPTY_MESSAGE = '(empty message)'



type SimpleLLMMessage = {
	role: 'tool';
	content: string;
	imageData?: string; // optional base64 image data (for screenshots to send to vision models)
	id: string;
	name: ToolName;
	rawParams: RawToolParamsObj;
} | {
	role: 'user';
	content: string;
	imageAttachments?: Array<{ type: 'image' | 'audio' | 'video', data: string, mimeType: string }>; // optional image/audio/video attachments (base64 data URLs)
} | {
	role: 'assistant';
	content: string;
	anthropicReasoning: AnthropicReasoning[] | null;
}



const CHARS_PER_TOKEN = 4 // assume abysmal chars per token
const TRIM_TO_LEN = 120




// convert messages as if about to send to openai
/*
reference - https://platform.openai.com/docs/guides/function-calling#function-calling-steps
openai MESSAGE (role=assistant):
"tool_calls":[{
	"type": "function",
	"id": "call_12345xyz",
	"function": {
	"name": "get_weather",
	"arguments": "{\"latitude\":48.8566,\"longitude\":2.3522}"
}]

openai RESPONSE (role=user):
{   "role": "tool",
	"tool_call_id": tool_call.id,
	"content": str(result)    }

also see
openai on prompting - https://platform.openai.com/docs/guides/reasoning#advice-on-prompting
openai on developer system message - https://cdn.openai.com/spec/model-spec-2024-05-08.html#follow-the-chain-of-command
*/


const prepareMessages_openai_tools = (messages: SimpleLLMMessage[], includeThoughtSignature: boolean = false, supportsVision: boolean = false): AnthropicOrOpenAILLMMessage[] => {

	const newMessages: OpenAILLMChatMessage[] = [];

	for (let i = 0; i < messages.length; i += 1) {
		const currMsg = messages[i]

		if (currMsg.role !== 'tool') {
			const msgCopy: any = { ...currMsg }
			
			// If this is a user message with attachments and vision is supported, format content as array
			if (currMsg.role === 'user' && supportsVision && currMsg.imageAttachments && currMsg.imageAttachments.length > 0) {
				// #region debug log
				console.log('[convertToLLMMessageService] prepareMessages_openai_tools: Processing image attachments', {
					supportsVision,
					imageAttachmentsCount: currMsg.imageAttachments.length,
					imageTypes: currMsg.imageAttachments.map(att => att.type),
					firstImageDataFormat: currMsg.imageAttachments[0]?.data?.substring(0, 50)
				});
				// #endregion
				
				const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
				// Add text content if it exists
				if (currMsg.content && currMsg.content.trim()) {
					contentParts.push({ type: 'text', text: currMsg.content });
				}
				// Add image attachments (only images for OpenAI, audio/video may not be supported)
				for (const att of currMsg.imageAttachments) {
					if (att.type === 'image') {
						// Validate and ensure data URL format is correct
						let imageUrl = att.data;
						
						// If it's not already a data URL, try to construct one
						if (!imageUrl.startsWith('data:')) {
							const mimeType = att.mimeType || 'image/png';
							// If it's already base64, wrap it in data URL format
							if (imageUrl.match(/^[A-Za-z0-9+/=]+$/)) {
								imageUrl = `data:${mimeType};base64,${imageUrl}`;
							} else {
								console.warn('[convertToLLMMessageService] prepareMessages_openai_tools: Invalid image data format, skipping image', {
									hasData: !!att.data,
									dataLength: att.data?.length,
									mimeType: att.mimeType
								});
								continue;
							}
						}
						
						// Validate data URL format
						if (!imageUrl.match(/^data:image\/[^;]+;base64,[A-Za-z0-9+/=]+$/)) {
							console.warn('[convertToLLMMessageService] prepareMessages_openai_tools: Invalid data URL format, skipping image', {
								urlPreview: imageUrl.substring(0, 50),
								mimeType: att.mimeType
							});
							continue;
						}
						
						contentParts.push({ type: 'image_url', image_url: { url: imageUrl } });
						
						// #region debug log
						console.log('[convertToLLMMessageService] prepareMessages_openai_tools: Added image to content parts', {
							mimeType: att.mimeType,
							urlPreview: imageUrl.substring(0, 60) + '...',
							totalParts: contentParts.length
						});
						// #endregion
					}
					// Note: OpenAI API may not support audio/video in the same way, so we skip them for now
				}
				msgCopy.content = contentParts.length > 0 ? contentParts : currMsg.content;
				
				// #region debug log
				console.log('[convertToLLMMessageService] prepareMessages_openai_tools: Final message content', {
					isArray: Array.isArray(msgCopy.content),
					contentLength: Array.isArray(msgCopy.content) ? msgCopy.content.length : msgCopy.content?.length,
					hasImages: Array.isArray(msgCopy.content) ? msgCopy.content.some((p: any) => p.type === 'image_url') : false
				});
				// #endregion
			} else if (Array.isArray(msgCopy.content)) {
				// It's already multipart, keep it
			} else if (typeof msgCopy.content === 'string') {
				// It's a string, keep it
			}

			// If this is an assistant message and we need thought_signature, add it to ALL tool_calls
			if (msgCopy.role === 'assistant' && includeThoughtSignature) {
				if (msgCopy.tool_calls && Array.isArray(msgCopy.tool_calls)) {
					msgCopy.tool_calls = msgCopy.tool_calls.map((tc: any) => ({
						...tc,
						thought_signature: true
					}))
				}
			}
			newMessages.push(msgCopy as OpenAILLMChatMessage)
			continue
		}

		// edit previous assistant message to have called the tool
		const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : undefined
		if (prevMsg?.role === 'assistant') {
			// Truncate ID to max 40 characters for Azure OpenAI compliance
			const toolCallId = currMsg.id.substring(0, 40);
			const toolCall: any = {
				type: 'function',
				id: toolCallId,
				function: {
					name: currMsg.name,
					arguments: JSON.stringify(currMsg.rawParams)
				}
			}
			
			// Add thought_signature if needed (for Gemini models via Pollinations with reasoning)
			if (includeThoughtSignature) {
				toolCall.thought_signature = true
			}
			
			if (!prevMsg.tool_calls) {
				prevMsg.tool_calls = []
			}
			if (!Array.isArray(prevMsg.tool_calls)) {
				prevMsg.tool_calls = [prevMsg.tool_calls]
			}
			prevMsg.tool_calls.push(toolCall)
		}

		// add the tool response
		// If model supports vision and we have image data, format content as array with text and image
		let toolContent: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = currMsg.content;
		if (supportsVision && currMsg.imageData) {
			toolContent = [
				{ type: 'text', text: currMsg.content },
				{ type: 'image_url', image_url: { url: currMsg.imageData } }
			];
		}
		
		// Truncate ID to max 40 characters for Azure OpenAI compliance
		const toolCallId = currMsg.id.substring(0, 40);
		newMessages.push({
			role: 'tool',
			tool_call_id: toolCallId,
			content: toolContent,
		})
	}
	return newMessages
}



// convert messages as if about to send to anthropic
/*
https://docs.anthropic.com/en/docs/build-with-claude/tool-use#tool-use-examples
anthropic MESSAGE (role=assistant):
"content": [{
	"type": "text",
	"text": "<thinking>I need to call the get_weather function, and the user wants SF, which is likely San Francisco, CA.</thinking>"
}, {
	"type": "tool_use",
	"id": "toolu_01A09q90qw90lq917835lq9",
	"name": "get_weather",
	"input": { "location": "San Francisco, CA", "unit": "celsius" }
}]
anthropic RESPONSE (role=user):
"content": [{
	"type": "tool_result",
	"tool_use_id": "toolu_01A09q90qw90lq917835lq9",
	"content": "15 degrees"
}]


Converts:
assistant: ...content
tool: (id, name, params)
->
assistant: ...content, call(name, id, params)
user: ...content, result(id, content)
*/

type AnthropicOrOpenAILLMMessage = AnthropicLLMChatMessage | OpenAILLMChatMessage

const prepareMessages_anthropic_tools = (messages: SimpleLLMMessage[], supportsAnthropicReasoning: boolean): AnthropicOrOpenAILLMMessage[] => {
	const newMessages: (AnthropicLLMChatMessage | (SimpleLLMMessage & { role: 'tool' }))[] = messages;

	for (let i = 0; i < messages.length; i += 1) {
		const currMsg = messages[i]

		// add anthropic reasoning
		if (currMsg.role === 'assistant') {
			if (currMsg.anthropicReasoning && supportsAnthropicReasoning) {
				const content = currMsg.content
				newMessages[i] = {
					role: 'assistant',
					content: content ? [...currMsg.anthropicReasoning, { type: 'text' as const, text: content }] : currMsg.anthropicReasoning
				}
			}
			else {
				newMessages[i] = {
					role: 'assistant',
					content: currMsg.content,
					// strip away anthropicReasoning
				}
			}
			continue
		}

		if (currMsg.role === 'user') {
			// If user message has image attachments, format content as array
			if (currMsg.imageAttachments && currMsg.imageAttachments.length > 0) {
				const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string } }> = [];
				// Add text content if it exists
				if (currMsg.content && currMsg.content.trim()) {
					contentParts.push({ type: 'text', text: currMsg.content });
				}
				// Add image attachments (Anthropic supports images via base64)
				for (const att of currMsg.imageAttachments) {
					if (att.type === 'image') {
						// Extract base64 data from data URL (remove data:mimeType;base64, prefix)
						const base64Match = att.data.match(/^data:([^;]+);base64,(.+)$/);
						if (base64Match) {
							const [, mimeType, base64Data] = base64Match;
							contentParts.push({ 
								type: 'image', 
								source: { 
									type: 'base64', 
									media_type: (mimeType || att.mimeType || 'image/png') as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
									data: base64Data 
								} 
							});
						}
					}
					// Note: Anthropic may not support audio/video in the same way, so we skip them for now
				}
				newMessages[i] = {
					role: 'user',
					content: contentParts.length > 0 ? contentParts : currMsg.content,
				}
			} else {
				newMessages[i] = {
					role: 'user',
					content: currMsg.content,
				}
			}
			continue
		}

		if (currMsg.role === 'tool') {
			// add anthropic tools
			const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : undefined

			// make it so the assistant called the tool
			if (prevMsg?.role === 'assistant') {
				if (typeof prevMsg.content === 'string') prevMsg.content = [{ type: 'text', text: prevMsg.content }]
				prevMsg.content.push({ type: 'tool_use', id: currMsg.id, name: currMsg.name, input: currMsg.rawParams })
			}

			// turn each tool into a user message with tool results at the end
			newMessages[i] = {
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: currMsg.id, content: currMsg.content }]
			}
			continue
		}

	}

	// we just removed the tools
	return newMessages as AnthropicLLMChatMessage[]
}


const prepareMessages_XML_tools = (messages: SimpleLLMMessage[], supportsAnthropicReasoning: boolean): AnthropicOrOpenAILLMMessage[] => {

	const llmChatMessages: AnthropicOrOpenAILLMMessage[] = [];
	for (let i = 0; i < messages.length; i += 1) {

		const c = messages[i]
		const next = 0 <= i + 1 && i + 1 <= messages.length - 1 ? messages[i + 1] : null

		if (c.role === 'assistant') {
			// if called a tool (message after it), re-add its XML to the message
			// alternatively, could just hold onto the original output, but this way requires less piping raw strings everywhere
			let content: AnthropicOrOpenAILLMMessage['content'] = c.content
			if (next?.role === 'tool') {
				content = `${content}\n\n${reParsedToolXMLString(next.name, next.rawParams)}`
			}

			// anthropic reasoning
			if (c.anthropicReasoning && supportsAnthropicReasoning) {
				content = content ? [...c.anthropicReasoning, { type: 'text' as const, text: content }] : c.anthropicReasoning
			}
			llmChatMessages.push({
				role: 'assistant',
				content
			})
		}
		// add user or tool to the previous user message
		else if (c.role === 'user' || c.role === 'tool') {
			if (c.role === 'tool')
				c.content = `<${c.name}_result>\n${c.content}\n</${c.name}_result>`

			if (llmChatMessages.length === 0 || llmChatMessages[llmChatMessages.length - 1].role !== 'user')
				llmChatMessages.push({
					role: 'user',
					content: c.content
				})
			else
				llmChatMessages[llmChatMessages.length - 1].content += '\n\n' + c.content
		}
	}
	return llmChatMessages
}


// --- CHAT ---

const prepareOpenAIOrAnthropicMessages = ({
	messages: messages_,
	systemMessage,
	aiInstructions,
	supportsSystemMessage,
	specialToolFormat,
	supportsAnthropicReasoning,
	contextWindow,
	reservedOutputTokenSpace,
	includeThoughtSignature,
	supportsVision,
}: {
	messages: SimpleLLMMessage[],
	systemMessage: string,
	aiInstructions: string,
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated',
	specialToolFormat: 'openai-style' | 'anthropic-style' | undefined,
	supportsAnthropicReasoning: boolean,
	contextWindow: number,
	reservedOutputTokenSpace: number | null | undefined,
	includeThoughtSignature?: boolean,
	supportsVision?: boolean,
}): { messages: AnthropicOrOpenAILLMMessage[], separateSystemMessage: string | undefined } => {

	reservedOutputTokenSpace = Math.max(
		contextWindow * 1 / 2, // reserve at least 1/4 of the token window length
		reservedOutputTokenSpace ?? 4_096 // defaults to 4096
	)
	let messages: (SimpleLLMMessage | { role: 'system', content: string })[] = deepClone(messages_)

	// ================ system message ================
	// A COMPLETE HACK: last message is system message for context purposes

	const sysMsgParts: string[] = []
	if (aiInstructions) sysMsgParts.push(`GUIDELINES (from the user's .voidrules file):\n${aiInstructions}`)
	if (systemMessage) sysMsgParts.push(systemMessage)
	const combinedSystemMessage = sysMsgParts.join('\n\n')

	messages.unshift({ role: 'system', content: combinedSystemMessage })

	// ================ trim ================
	messages = messages.map(m => ({ ...m, content: m.role !== 'tool' ? m.content.trim() : m.content }))

	type MesType = (typeof messages)[0]

	// ================ fit into context ================

	// the higher the weight, the higher the desire to truncate - TRIM HIGHEST WEIGHT MESSAGES
	const alreadyTrimmedIdxes = new Set<number>()
	const weight = (message: MesType, messages: MesType[], idx: number) => {
		const base = message.content.length

		let multiplier: number
		multiplier = 1 + (messages.length - 1 - idx) / messages.length // slow rampdown from 2 to 1 as index increases
		if (message.role === 'user') {
			multiplier *= 1
		}
		else if (message.role === 'system') {
			multiplier *= .01 // very low weight
		}
		else {
			multiplier *= 10 // llm tokens are far less valuable than user tokens
		}

		// any already modified message should not be trimmed again
		if (alreadyTrimmedIdxes.has(idx)) {
			multiplier = 0
		}
		// 1st and last messages should be very low weight
		if (idx <= 1 || idx >= messages.length - 1 - 3) {
			multiplier *= .05
		}
		return base * multiplier
	}

	const _findLargestByWeight = (messages_: MesType[]) => {
		let largestIndex = -1
		let largestWeight = -Infinity
		for (let i = 0; i < messages.length; i += 1) {
			const m = messages[i]
			const w = weight(m, messages_, i)
			if (w > largestWeight) {
				largestWeight = w
				largestIndex = i
			}
		}
		return largestIndex
	}

	let totalLen = 0
	for (const m of messages) { totalLen += m.content.length }
	const charsNeedToTrim = totalLen - Math.max(
		(contextWindow - reservedOutputTokenSpace) * CHARS_PER_TOKEN, // can be 0, in which case charsNeedToTrim=everything, bad
		5_000 // ensure we don't trim at least 5k chars (just a random small value)
	)


	// <----------------------------------------->
	// 0                      |    |             |
	//                        |    contextWindow |
	//                     contextWindow - maxOut|putTokens
	//                                          totalLen
	let remainingCharsToTrim = charsNeedToTrim
	let i = 0

	while (remainingCharsToTrim > 0) {
		i += 1
		if (i > 100) break

		const trimIdx = _findLargestByWeight(messages)
		const m = messages[trimIdx]

		// if can finish here, do
		const numCharsWillTrim = m.content.length - TRIM_TO_LEN
		if (numCharsWillTrim > remainingCharsToTrim) {
			// trim remainingCharsToTrim + '...'.length chars
			m.content = m.content.slice(0, m.content.length - remainingCharsToTrim - '...'.length).trim() + '...'
			break
		}

		remainingCharsToTrim -= numCharsWillTrim
		m.content = m.content.substring(0, TRIM_TO_LEN - '...'.length) + '...'
		alreadyTrimmedIdxes.add(trimIdx)
	}

	// ================ system message hack ================
	const newSysMsg = messages.shift()!.content


	// ================ tools and anthropicReasoning ================
	// SYSTEM MESSAGE HACK: we shifted (removed) the system message role, so now SimpleLLMMessage[] is valid

	let llmChatMessages: AnthropicOrOpenAILLMMessage[] = []
	if (!specialToolFormat) { // XML tool behavior
		llmChatMessages = prepareMessages_XML_tools(messages as SimpleLLMMessage[], supportsAnthropicReasoning)
	}
	else if (specialToolFormat === 'anthropic-style') {
		llmChatMessages = prepareMessages_anthropic_tools(messages as SimpleLLMMessage[], supportsAnthropicReasoning)
	}
	else if (specialToolFormat === 'openai-style') {
		llmChatMessages = prepareMessages_openai_tools(messages as SimpleLLMMessage[], includeThoughtSignature ?? false, supportsVision ?? false)
	}
	const llmMessages = llmChatMessages


	// ================ system message add as first llmMessage ================

	let separateSystemMessageStr: string | undefined = undefined

	// if supports system message
	if (supportsSystemMessage) {
		if (supportsSystemMessage === 'separated')
			separateSystemMessageStr = newSysMsg
		else if (supportsSystemMessage === 'system-role')
			llmMessages.unshift({ role: 'system', content: newSysMsg }) // add new first message
		else if (supportsSystemMessage === 'developer-role')
			llmMessages.unshift({ role: 'developer', content: newSysMsg }) // add new first message
	}
	// if does not support system message
	else {
		const newFirstMessage = {
			role: 'user',
			content: `<SYSTEM_MESSAGE>\n${newSysMsg}\n</SYSTEM_MESSAGE>\n${llmMessages[0].content}`
		} as const
		llmMessages.splice(0, 1) // delete first message
		llmMessages.unshift(newFirstMessage) // add new first message
	}


	// ================ no empty message ================
	for (let i = 0; i < llmMessages.length; i += 1) {
		const currMsg: AnthropicOrOpenAILLMMessage = llmMessages[i]
		const nextMsg: AnthropicOrOpenAILLMMessage | undefined = llmMessages[i + 1]

		if (currMsg.role === 'tool') continue

		// if content is a string, replace string with empty msg
		if (typeof currMsg.content === 'string') {
			currMsg.content = currMsg.content || EMPTY_MESSAGE
		}
		else {
			// allowed to be empty if has a tool in it or following it
			if (currMsg.content.find(c => c.type === 'tool_result' || c.type === 'tool_use')) {
				currMsg.content = currMsg.content.filter(c => !(c.type === 'text' && !c.text)) as any
				continue
			}
			if (nextMsg?.role === 'tool') continue

			// replace any empty text entries with empty msg, and make sure there's at least 1 entry
			for (const c of currMsg.content) {
				if (c.type === 'text') c.text = c.text || EMPTY_MESSAGE
			}
			if (currMsg.content.length === 0) currMsg.content = [{ type: 'text', text: EMPTY_MESSAGE }]
		}
	}

	return {
		messages: llmMessages,
		separateSystemMessage: separateSystemMessageStr,
	} as const
}




type GeminiUserPart = (GeminiLLMChatMessage & { role: 'user' })['parts'][0]
type GeminiModelPart = (GeminiLLMChatMessage & { role: 'model' })['parts'][0]
const prepareGeminiMessages = (messages: AnthropicLLMChatMessage[]) => {
	let latestToolName: ToolName | undefined = undefined
	const messages2: GeminiLLMChatMessage[] = messages.map((m): GeminiLLMChatMessage | null => {
		if (m.role === 'assistant') {
			if (typeof m.content === 'string') {
				return { role: 'model', parts: [{ text: m.content }] }
			}
			else {
				const parts: GeminiModelPart[] = m.content.map((c): GeminiModelPart | null => {
					if (c.type === 'text') {
						return { text: c.text }
					}
					else if (c.type === 'tool_use') {
						latestToolName = c.name
						return { functionCall: { id: c.id, name: c.name, args: c.input } }
					}
					else return null
				}).filter(m => !!m)
				return { role: 'model', parts, }
			}
		}
		else if (m.role === 'user') {
			if (typeof m.content === 'string') {
				return { role: 'user', parts: [{ text: m.content }] } satisfies GeminiLLMChatMessage
			}
			else {
				const parts: GeminiUserPart[] = m.content.map((c): GeminiUserPart | null => {
					if (c.type === 'text') {
						return { text: c.text }
					}
					else if (c.type === 'tool_result') {
						if (!latestToolName) return null
						return { functionResponse: { id: c.tool_use_id, name: latestToolName, response: { output: c.content } } }
					}
					else return null
				}).filter(m => !!m)
				return { role: 'user', parts, }
			}

		}
		else return null
	}).filter(m => !!m)

	return messages2
}


const prepareMessages = (params: {
	messages: SimpleLLMMessage[],
	systemMessage: string,
	aiInstructions: string,
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated',
	specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined,
	supportsAnthropicReasoning: boolean,
	contextWindow: number,
	reservedOutputTokenSpace: number | null | undefined,
	providerName: ProviderName,
	includeThoughtSignature?: boolean,
	supportsVision?: boolean,
}): { messages: LLMChatMessage[], separateSystemMessage: string | undefined } => {

	const specialFormat = params.specialToolFormat // this is just for ts stupidness

	// if need to convert to gemini style of messaes, do that (treat as anthropic style, then convert to gemini style)
	if (params.providerName === 'gemini' || specialFormat === 'gemini-style') {
		const res = prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat === 'gemini-style' ? 'anthropic-style' : undefined, includeThoughtSignature: params.includeThoughtSignature, supportsVision: params.supportsVision })
		const messages = res.messages as AnthropicLLMChatMessage[]
		const messages2 = prepareGeminiMessages(messages)
		return { messages: messages2, separateSystemMessage: res.separateSystemMessage }
	}

	return prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat, includeThoughtSignature: params.includeThoughtSignature, supportsVision: params.supportsVision })
}




export interface IConvertToLLMMessageService {
	readonly _serviceBrand: undefined;
	prepareLLMSimpleMessages: (opts: { simpleMessages: SimpleLLMMessage[], systemMessage: string, modelSelection: ModelSelection | null, featureName: FeatureName }) => { messages: LLMChatMessage[], separateSystemMessage: string | undefined }
	prepareLLMChatMessages: (opts: { chatMessages: ChatMessage[], chatMode: ChatMode, modelSelection: ModelSelection | null }) => Promise<{ messages: LLMChatMessage[], separateSystemMessage: string | undefined }>
	prepareFIMMessage(opts: { messages: LLMFIMMessage, }): { prefix: string, suffix: string, stopTokens: string[] }
}

export const IConvertToLLMMessageService = createDecorator<IConvertToLLMMessageService>('ConvertToLLMMessageService');


class ConvertToLLMMessageService extends Disposable implements IConvertToLLMMessageService {
	_serviceBrand: undefined;

	constructor(
		@IModelService private readonly modelService: IModelService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly editorService: IEditorService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IVoidModelService private readonly voidModelService: IVoidModelService,
		@IMCPService private readonly mcpService: IMCPService,
	) {
		super()
	}

	// Read .voidrules files from workspace folders
	private _getVoidRulesFileContents(): string {
		try {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			let voidRules = '';
			for (const folder of workspaceFolders) {
				const uri = URI.joinPath(folder.uri, '.voidrules')
				const { model } = this.voidModelService.getModel(uri)
				if (!model) continue
				voidRules += model.getValue(EndOfLinePreference.LF) + '\n\n';
			}
			return voidRules.trim();
		}
		catch (e) {
			return ''
		}
	}

	// Get combined AI instructions from settings and .voidrules files
	private _getCombinedAIInstructions(): string {
		const globalAIInstructions = this.voidSettingsService.state.globalSettings.aiInstructions;
		const voidRulesFileContent = this._getVoidRulesFileContents();

		const ans: string[] = []
		if (globalAIInstructions) ans.push(globalAIInstructions)
		if (voidRulesFileContent) ans.push(voidRulesFileContent)
		return ans.join('\n\n')
	}


	// system message
	private _generateChatMessagesSystemMessage = async (chatMode: ChatMode, specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined) => {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders.map(f => f.uri.fsPath)

		const openedURIs = this.modelService.getModels().filter(m => m.isAttachedToEditor()).map(m => m.uri.fsPath) || [];
		const activeURI = this.editorService.activeEditor?.resource?.fsPath;

		const directoryStr = await this.directoryStrService.getAllDirectoriesStr({
			cutOffMessage: chatMode === 'agent' || chatMode === 'gather' ?
				`...Directories string cut off, use tools to read more...`
				: `...Directories string cut off, ask user for more if necessary...`
		})

		const includeXMLToolDefinitions = !specialToolFormat

		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'convertToLLMMessageService.ts:624',message:'_generateChatMessagesSystemMessage: entry',data:{chatMode,specialToolFormat,includeXMLToolDefinitions},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
		// #endregion

		// Get MCP tools with retry and validation
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'convertToLLMMessageService.ts:631',message:'prepareSystemMessage: before getMCPTools',data:{chatMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
		// #endregion
		const mcpTools = this._getMCPToolsWithRetry()
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'convertToLLMMessageService.ts:629',message:'prepareSystemMessage: after getMCPTools',data:{chatMode,mcpToolsCount:mcpTools?.length||0,mcpToolsNames:mcpTools?.map(t=>t.name)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
		// #endregion
		const persistentTerminalIDs = this.terminalToolService.listPersistentTerminalIds()
		
		// Get agent superpower mode and multi-agent settings
		const settingsState = this.voidSettingsService.state
		const agentSuperpowerMode = (chatMode === 'agent' || chatMode === 'multi-agent') ? 
			(settingsState.globalSettings.agentSuperpowerMode || 'plan') : null
		const isMultiAgentEnabled = chatMode === 'multi-agent' && settingsState.globalSettings.multiAgentSettings.enabled

		const systemMessage = chat_systemMessage({ 
			workspaceFolders, 
			openedURIs, 
			directoryStr, 
			activeURI, 
			persistentTerminalIDs, 
			chatMode, 
			mcpTools, 
			includeXMLToolDefinitions,
			agentSuperpowerMode,
			isMultiAgentEnabled,
		})
		
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'convertToLLMMessageService.ts:654',message:'_generateChatMessagesSystemMessage: result',data:{systemMessageLength:systemMessage.length,includesTools:systemMessage.includes('Available Tools')||systemMessage.includes('browser_navigate')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
		// #endregion
		
		return systemMessage
	}




	// --- LLM Chat messages ---

	private _chatMessagesToSimpleMessages(chatMessages: ChatMessage[]): SimpleLLMMessage[] {
		const simpleLLMMessages: SimpleLLMMessage[] = []

		for (const m of chatMessages) {
			if (m.role === 'checkpoint') continue
			if (m.role === 'interrupted_streaming_tool') continue
			if (m.role === 'assistant') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.displayContent,
					anthropicReasoning: m.anthropicReasoning,
				})
			}
			else if (m.role === 'tool') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.content,
					imageData: m.imageData,
					name: m.name,
					id: m.id,
					rawParams: m.rawParams,
				})
			}
			else if (m.role === 'user') {
				// Pass content and image attachments
				simpleLLMMessages.push({
					role: m.role,
					content: m.content,
					imageAttachments: m.imageAttachments,
				})
			}
		}
		return simpleLLMMessages
	}

	prepareLLMSimpleMessages: IConvertToLLMMessageService['prepareLLMSimpleMessages'] = ({ simpleMessages, systemMessage, modelSelection, featureName }) => {
		if (modelSelection === null) return { messages: [], separateSystemMessage: undefined }

		const { overridesOfModel } = this.voidSettingsService.state

		const { providerName, modelName } = modelSelection
		const {
			specialToolFormat,
			contextWindow,
			supportsSystemMessage,
			supportsVision,
		} = getModelCapabilities(providerName, modelName, overridesOfModel)

		// #region debug log
		const userSimpleMessages = simpleMessages.filter((m): m is Extract<SimpleLLMMessage, { role: 'user' }> => m.role === 'user');
		const hasImageAttachments = userSimpleMessages.some(m => 'imageAttachments' in m && m.imageAttachments && m.imageAttachments.length > 0);
		const imageAttachmentsCount = userSimpleMessages
			.filter(m => 'imageAttachments' in m && m.imageAttachments)
			.reduce((sum, m) => sum + (m.imageAttachments?.length || 0), 0);
		console.log('[convertToLLMMessageService] prepareLLMSimpleMessages: Model capabilities', {
			providerName,
			modelName,
			supportsVision,
			supportsVisionType: typeof supportsVision,
			hasImageAttachments,
			specialToolFormat,
			imageAttachmentsCount
		});
		// #endregion

		const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]

		// Get combined AI instructions
		const aiInstructions = this._getCombinedAIInstructions();

		const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)
		
		// Check if we need to disable reasoning for Pollinations Gemini with tools
		// Vertex AI requires thought_signature when reasoning is enabled, which causes errors
		const hasTools = simpleMessages.some(m => m.role === 'tool')
		const shouldDisableReasoningForPollinations = providerName === 'pollinations' && 
			modelName.startsWith('gemini') && 
			hasTools &&
			specialToolFormat === 'openai-style';
		
		const effectiveReasoningEnabled = shouldDisableReasoningForPollinations ? false : isReasoningEnabled
		const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled: effectiveReasoningEnabled, overridesOfModel })

		// Check if we need thought_signature: Pollinations + Gemini + Tools
		// Vertex AI requires thought_signature for tool calls when reasoning is enabled OR for some models/configurations
		const isPollinationsGeminiWithTools = providerName === 'pollinations' && 
			modelName.startsWith('gemini') && 
			hasTools &&
			specialToolFormat === 'openai-style';

		const supportsVisionFinal = supportsVision === true;
		// #region debug log
		console.log('[convertToLLMMessageService] prepareLLMSimpleMessages: Calling prepareMessages', {
			supportsVisionRaw: supportsVision,
			supportsVisionFinal,
			hasImageAttachments,
			willIncludeImages: supportsVisionFinal && hasImageAttachments
		});
		// #endregion

		const { messages, separateSystemMessage } = prepareMessages({
			messages: simpleMessages,
			systemMessage,
			aiInstructions,
			supportsSystemMessage,
			specialToolFormat,
			supportsAnthropicReasoning: providerName === 'anthropic',
			contextWindow,
			reservedOutputTokenSpace,
			providerName,
			includeThoughtSignature: isPollinationsGeminiWithTools,
			supportsVision: supportsVisionFinal,
		})
		return { messages, separateSystemMessage };
	}
	prepareLLMChatMessages: IConvertToLLMMessageService['prepareLLMChatMessages'] = async ({ chatMessages, chatMode, modelSelection }) => {
		if (modelSelection === null) return { messages: [], separateSystemMessage: undefined }

		const { overridesOfModel } = this.voidSettingsService.state

		const { providerName, modelName } = modelSelection
		const {
			specialToolFormat,
			contextWindow,
			supportsSystemMessage,
			supportsVision,
		} = getModelCapabilities(providerName, modelName, overridesOfModel)

		// #region debug log
		const userChatMessages = chatMessages.filter((m): m is Extract<ChatMessage, { role: 'user' }> => m.role === 'user');
		const hasImageAttachments = userChatMessages.some(m => 'imageAttachments' in m && m.imageAttachments && m.imageAttachments.length > 0);
		const imageAttachmentsCount = userChatMessages
			.filter(m => 'imageAttachments' in m && m.imageAttachments)
			.reduce((sum, m) => sum + (m.imageAttachments?.length || 0), 0);
		console.log('[convertToLLMMessageService] prepareLLMChatMessages: Model capabilities', {
			providerName,
			modelName,
			supportsVision,
			supportsVisionType: typeof supportsVision,
			hasImageAttachments,
			specialToolFormat,
			imageAttachmentsCount
		});
		// #endregion

		const { disableSystemMessage } = this.voidSettingsService.state.globalSettings;
		const fullSystemMessage = await this._generateChatMessagesSystemMessage(chatMode, specialToolFormat)
		const systemMessage = disableSystemMessage ? '' : fullSystemMessage;

		const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName]

		// Get combined AI instructions
		const aiInstructions = this._getCombinedAIInstructions();
		const isReasoningEnabled = getIsReasoningEnabledState('Chat', providerName, modelName, modelSelectionOptions, overridesOfModel)
		
		// Check if we need to disable reasoning for Pollinations Gemini with tools
		// Vertex AI requires thought_signature when reasoning is enabled, which causes errors
		// Tools are available when chatMode is 'agent' or 'gather', OR when there are MCP tools
		const mcpTools = this._getMCPToolsWithRetry()
		const hasToolsAvailable = (chatMode === 'agent' || chatMode === 'gather') || (mcpTools && Array.isArray(mcpTools) && mcpTools.length > 0)
		const shouldDisableReasoningForPollinations = providerName === 'pollinations' && 
			modelName.startsWith('gemini') && 
			hasToolsAvailable &&
			specialToolFormat === 'openai-style';
		
		const effectiveReasoningEnabled = shouldDisableReasoningForPollinations ? false : isReasoningEnabled
		const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled: effectiveReasoningEnabled, overridesOfModel })
		const llmMessages = this._chatMessagesToSimpleMessages(chatMessages)

		// Check if we need thought_signature: Pollinations + Gemini + Tools
		// Vertex AI requires thought_signature for tool calls when reasoning is enabled OR for some models/configurations
		const isPollinationsGeminiWithTools = providerName === 'pollinations' && 
			modelName.startsWith('gemini') && 
			hasToolsAvailable &&
			specialToolFormat === 'openai-style';

		const supportsVisionFinal = supportsVision === true;
		// #region debug log
		console.log('[convertToLLMMessageService] prepareLLMChatMessages: Calling prepareMessages', {
			supportsVisionRaw: supportsVision,
			supportsVisionFinal,
			hasImageAttachments,
			willIncludeImages: supportsVisionFinal && hasImageAttachments
		});
		// #endregion

		const { messages, separateSystemMessage } = prepareMessages({
			messages: llmMessages,
			systemMessage,
			aiInstructions,
			supportsSystemMessage,
			specialToolFormat,
			supportsAnthropicReasoning: providerName === 'anthropic',
			contextWindow,
			reservedOutputTokenSpace,
			providerName,
			includeThoughtSignature: isPollinationsGeminiWithTools,
			supportsVision: supportsVisionFinal,
		})
		return { messages, separateSystemMessage };
	}


	// --- FIM ---

	prepareFIMMessage: IConvertToLLMMessageService['prepareFIMMessage'] = ({ messages }) => {
		// Get combined AI instructions with the provided aiInstructions as the base
		const combinedInstructions = this._getCombinedAIInstructions();

		let prefix = `\
${!combinedInstructions ? '' : `\
// Instructions:
// Do not output an explanation. Try to avoid outputting comments. Only output the middle code.
${combinedInstructions.split('\n').map(line => `//${line}`).join('\n')}`}

${messages.prefix}`

		const suffix = messages.suffix
		const stopTokens = messages.stopTokens
		return { prefix, suffix, stopTokens }
	}

	/**
	 * Get MCP tools with validation
	 * Validates that tools are properly structured and filters out invalid entries
	 * This helps handle cases where MCP servers are still initializing or have partial data
	 */
	private _getMCPToolsWithRetry(): InternalToolInfo[] | undefined {
		try {
			const tools = this.mcpService.getMCPTools()
			
			// #region agent log
			fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'convertToLLMMessageService.ts:808',message:'_getMCPToolsWithRetry: raw tools from mcpService',data:{toolsCount:tools?.length||0,toolsNames:tools?.map(t=>t.name)||[],hasBrowserTools:tools?.some(t=>t.name?.includes('browser'))||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
			// #endregion
			
			// Validate tools structure
			if (tools === undefined || tools === null) {
				return undefined
			}
			
			if (!Array.isArray(tools)) {
				console.warn('MCP tools is not an array:', typeof tools)
				return undefined
			}
			
			// Validate each tool has required properties
			const validTools = tools.filter(tool => {
				if (!tool || typeof tool !== 'object') {
					console.warn('Invalid MCP tool: not an object', tool)
					return false
				}
				if (!('name' in tool) || typeof tool.name !== 'string' || tool.name.length === 0) {
					console.warn('Invalid MCP tool: missing or invalid name', tool)
					return false
				}
				if (!('description' in tool) || typeof tool.description !== 'string') {
					console.warn('Invalid MCP tool: missing or invalid description', tool)
					return false
				}
				// Validate params exists and is an object (can be empty)
				if (!('params' in tool) || typeof tool.params !== 'object' || tool.params === null) {
					console.warn('Invalid MCP tool: missing or invalid params', tool)
					return false
				}
				return true
			})
			
			// Filtrar ferramentas de browser se sharedBrowserEnabled === false
			const sharedBrowserEnabled = this.voidSettingsService.state.globalSettings.sharedBrowserEnabled
			const filteredTools = sharedBrowserEnabled 
				? validTools 
				: validTools.filter(tool => {
					// Filtrar ferramentas que começam com mcp_cursor-ide-browser_ ou mcp_cursor-browser-extension_
					// ou contêm 'browser_' no nome
					const isBrowserTool = tool.name.startsWith('mcp_cursor-ide-browser_') ||
						tool.name.startsWith('mcp_cursor-browser-extension_') ||
						tool.name.includes('browser_')
					return !isBrowserTool
				})
			
			const result = filteredTools.length > 0 ? filteredTools : undefined
			// #region agent log
			fetch('http://127.0.0.1:7243/ingest/1ce6e17d-b708-4230-aa86-6bd5be848bbc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'convertToLLMMessageService.ts:846',message:'_getMCPToolsWithRetry: validated tools result',data:{validToolsCount:validTools.length,filteredToolsCount:filteredTools.length,sharedBrowserEnabled,resultCount:result?.length||0,validToolsNames:validTools.map(t=>t.name)||[],filteredToolsNames:filteredTools.map(t=>t.name)||[],hasBrowserTools:result?.some(t=>t.name?.includes('browser'))||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
			// #endregion
			return result
		} catch (error) {
			console.warn('Error getting MCP tools:', error)
			return undefined
		}
	}


}


registerSingleton(IConvertToLLMMessageService, ConvertToLLMMessageService, InstantiationType.Eager);








/*
Gemini has this, but they're openai-compat so we don't need to implement this
gemini request:
{   "role": "assistant",
	"content": null,
	"function_call": {
		"name": "get_weather",
		"arguments": {
			"latitude": 48.8566,
			"longitude": 2.3522
		}
	}
}

gemini response:
{   "role": "assistant",
	"function_response": {
		"name": "get_weather",
			"response": {
			"temperature": "15°C",
				"condition": "Cloudy"
		}
	}
}
*/



