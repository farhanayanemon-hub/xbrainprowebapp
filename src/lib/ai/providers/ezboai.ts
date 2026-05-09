import type {
	AIProvider,
	AIModelConfig,
	AIMessage,
	AIResponse,
	AIStreamChunk,
	ChatCompletionParams,
} from '../types.js';
import { openRouterProvider } from './openrouter.js';
import { loadXBrainConfig, DEFAULTS, type Category, type Tier } from '../../server/xbrain-config.js';

const EZBO_MODEL_1 = 'ezbo/ezbo-1.0';
const EZBO_MODEL_1_PRO = 'ezbo/ezbo-1.0-pro';
const EZBO_MODEL_THINKING = 'ezbo/xbrain-p2-thinking';

const TIER_BY_MODEL: Record<string, Tier> = {
	[EZBO_MODEL_1]: 'free',
	[EZBO_MODEL_1_PRO]: 'pro',
	[EZBO_MODEL_THINKING]: 'thinking',
};

function tierOf(name: string): Tier | null {
	return TIER_BY_MODEL[name] || null;
}

// Build the public model list dynamically from current config (with defaults as fallback).
// We export a getter so the model list reflects admin edits without a restart.
async function buildModels(): Promise<AIModelConfig[]> {
	const { configs } = await loadXBrainConfig();
	const out: AIModelConfig[] = [];
	const entries: Array<[string, Tier]> = [
		[EZBO_MODEL_1, 'free'],
		[EZBO_MODEL_1_PRO, 'pro'],
		[EZBO_MODEL_THINKING, 'thinking'],
	];
	for (const [name, tier] of entries) {
		const c = configs[tier];
		if (!c.enabled) continue;
		out.push({
			name,
			displayName: c.displayName,
			provider: 'XBrainPro',
			maxTokens: c.maxTokens,
			supportsStreaming: true,
			supportsFunctions: true,
			supportsImageInput: true,
			supportsTextInput: true,
			supportsTextGeneration: true,
		});
	}
	return out;
}

// Synchronous default list (used at module load before first DB read).
const STATIC_FALLBACK_MODELS: AIModelConfig[] = (['free','pro','thinking'] as Tier[]).map((tier) => {
	const name = tier === 'free' ? EZBO_MODEL_1 : tier === 'pro' ? EZBO_MODEL_1_PRO : EZBO_MODEL_THINKING;
	const c = DEFAULTS[tier];
	return {
		name,
		displayName: c.displayName,
		provider: 'XBrainPro',
		maxTokens: c.maxTokens,
		supportsStreaming: true,
		supportsFunctions: true,
		supportsImageInput: true,
		supportsTextInput: true,
		supportsTextGeneration: true,
	};
});

function lastUserText(messages: AIMessage[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg?.role === 'user' && typeof msg.content === 'string' && msg.content.trim()) {
			return msg.content.slice(0, 2000);
		}
	}
	return '';
}

function hasImageContent(messages: AIMessage[]): boolean {
	return messages.some(
		(m) =>
			!!m.imageId ||
			!!m.imageData ||
			(Array.isArray(m.imageIds) && m.imageIds.length > 0) ||
			(Array.isArray(m.images) && m.images.length > 0)
	);
}

function isEzboModel(name: string): boolean {
	return !!tierOf(name);
}

function injectIdentity(messages: AIMessage[], systemPrompt: string): AIMessage[] {
	return [{ role: 'system', content: systemPrompt }, ...messages];
}

function parseCategory(raw: string): Category | null {
	if (!raw) return null;
	const tryJson = (s: string): Category | null => {
		try {
			const obj = JSON.parse(s);
			const c = (obj?.category || obj?.cat || '').toString().toLowerCase();
			if (['code','math','creative','factual','conversation','analysis','vision'].includes(c)) return c as Category;
		} catch { /* ignore */ }
		return null;
	};
	let cat = tryJson(raw.trim());
	if (cat) return cat;
	const match = raw.match(/\{[\s\S]*?\}/);
	if (match) { cat = tryJson(match[0]); if (cat) return cat; }
	const lower = raw.toLowerCase();
	for (const c of ['code','math','creative','factual','conversation','analysis','vision'] as Category[]) {
		if (lower.includes(c)) return c;
	}
	return null;
}

async function routeQuestion(userText: string, hasImage: boolean, routerModel: string): Promise<Category> {
	if (hasImage) return 'vision';
	if (!userText.trim()) return 'conversation';
	const classifierMessages: AIMessage[] = [
		{ role: 'system', content: 'You are a routing classifier. Read the user message and respond with ONLY a JSON object of the form {"category":"<one of: code|math|creative|factual|conversation|analysis|vision>"}. Do not write anything else. Definitions: code=programming/debugging/scripts; math=calculation/equations/scientific; creative=stories/poems/brainstorm/marketing copy; factual=facts/summaries/general knowledge; conversation=greetings/chitchat/short reply; analysis=multi-step reasoning, comparison, planning; vision=anything about an image.' },
		{ role: 'user', content: userText },
	];
	try {
		const result = (await openRouterProvider.chat({
			model: routerModel,
			messages: classifierMessages,
			maxTokens: 32,
			temperature: 0,
			stream: false,
		})) as AIResponse;
		return parseCategory((result?.content || '').toString()) || 'conversation';
	} catch (err) {
		console.warn('[XBrainPro] router classification failed, using default:', err);
		return 'conversation';
	}
}

async function* scrubStream(source: AsyncIterableIterator<AIStreamChunk>): AsyncIterableIterator<AIStreamChunk> {
	for await (const chunk of source) yield chunk;
}

async function dispatch(params: ChatCompletionParams, isMultimodal: boolean): Promise<AIResponse | AsyncIterableIterator<AIStreamChunk>> {
	const { model, messages, stream } = params;
	const tier = tierOf(model);
	if (!tier) throw new Error(`XBrainPro provider does not handle model: ${model}`);

	const { configs, routerModel } = await loadXBrainConfig();
	const cfg = configs[tier];

	const userText = lastUserText(messages);
	const imagesPresent = hasImageContent(messages);
	const category = await routeQuestion(userText, imagesPresent, routerModel);
	const targetModel = cfg.routes[category] || cfg.defaultModel;
	const finalMessages = injectIdentity(messages, cfg.systemPrompt);

	// Apply admin-controlled maxTokens/temperature unless explicitly overridden by caller
	const mergedParams: ChatCompletionParams = {
		...params,
		model: targetModel,
		messages: finalMessages,
		maxTokens: params.maxTokens ?? cfg.maxTokens,
		temperature: params.temperature ?? cfg.temperature,
	};

	const result = isMultimodal
		? await openRouterProvider.chatMultimodal!(mergedParams)
		: await openRouterProvider.chat(mergedParams);

	if (stream) return scrubStream(result as AsyncIterableIterator<AIStreamChunk>);
	const r = result as AIResponse;
	return { ...r, model };
}

export const ezboaiProvider: AIProvider = {
	name: 'XBrainPro',
	models: STATIC_FALLBACK_MODELS,
	async chat(params) { return dispatch(params, false); },
	async chatMultimodal(params) {
		if (!openRouterProvider.chatMultimodal) throw new Error('Multimodal not supported by underlying provider');
		return dispatch(params, true);
	},
};

export { EZBO_MODEL_1, EZBO_MODEL_1_PRO, EZBO_MODEL_THINKING, buildModels };
