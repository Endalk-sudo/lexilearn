/**
 * Unified AI Provider client for LexiLearn AI Mentor.
 * Supports:
 * 1. Local Ollama (100% offline & local)
 * 2. OpenRouter (Access to Claude, GPT-4o, Llama 3, DeepSeek, etc.)
 * 3. Google Gemini (Gemini 2.5 Flash, 1.5 Flash, 1.5 Pro)
 */

import { db } from '@/lib/db'
import { appStat } from '@/db/schema'
import { inArray, eq } from 'drizzle-orm'

export type AiProviderType = 'auto' | 'ollama' | 'openrouter' | 'gemini'

export type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiChatOptions = {
  model?: string
  temperature?: number
  format?: 'json' | null
  provider?: AiProviderType
}

export type AiResolvedConfig = {
  provider: 'ollama' | 'openrouter' | 'gemini'
  model: string
  apiKey?: string
  baseUrl: string
}

export type AiStatus = {
  available: boolean
  provider: 'ollama' | 'openrouter' | 'gemini' | 'none'
  model: string
  models: string[]
  error?: string
}

// Default models per provider
export const DEFAULT_MODELS: Record<'ollama' | 'openrouter' | 'gemini', string> = {
  ollama: 'qwen3:8b',
  openrouter: 'google/gemini-2.5-flash',
  gemini: 'gemini-2.5-flash',
}

export const POPULAR_MODELS = {
  openrouter: [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Cheap)' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (Open Weights)' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (High capability)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (State of the art)' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast & Reliable)' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep reasoning)' },
  ],
  ollama: [
    { id: 'qwen3:8b', name: 'Qwen 3 8B (Default)' },
    { id: 'llama3.2:latest', name: 'Llama 3.2' },
    { id: 'mistral:latest', name: 'Mistral 7B' },
  ],
}

/** Fetch AI settings from database AppStat table with process.env fallbacks */
export async function getAiConfig(): Promise<{
  provider: AiProviderType
  openRouterApiKey?: string
  openRouterModel: string
  geminiApiKey?: string
  geminiModel: string
  ollamaBaseUrl: string
  ollamaModel: string
}> {
  let statsMap = new Map<string, string>()
  try {
    const stats = await db
      .select()
      .from(appStat)
      .where(
        inArray(appStat.key, [
          'aiProvider',
          'openRouterApiKey',
          'openRouterModel',
          'geminiApiKey',
          'geminiModel',
          'ollamaBaseUrl',
          'ollamaModel',
        ])
      )
    statsMap = new Map(stats.map((s) => [s.key, s.value]))
  } catch {
    // Database might not be ready or in an isolated test environment
  }

  const env = process.env

  const provider = (statsMap.get('aiProvider') ||
    env.AI_PROVIDER ||
    'auto') as AiProviderType

  const openRouterApiKey =
    statsMap.get('openRouterApiKey') || env.OPENROUTER_API_KEY || ''
  const openRouterModel =
    statsMap.get('openRouterModel') ||
    env.OPENROUTER_MODEL ||
    DEFAULT_MODELS.openrouter

  const geminiApiKey =
    statsMap.get('geminiApiKey') || env.GEMINI_API_KEY || ''
  const geminiModel =
    statsMap.get('geminiModel') ||
    env.GEMINI_MODEL ||
    DEFAULT_MODELS.gemini

  const ollamaBaseUrl =
    (statsMap.get('ollamaBaseUrl') || env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const ollamaModel =
    statsMap.get('ollamaModel') || env.OLLAMA_MODEL || DEFAULT_MODELS.ollama

  return {
    provider,
    openRouterApiKey: openRouterApiKey || undefined,
    openRouterModel,
    geminiApiKey: geminiApiKey || undefined,
    geminiModel,
    ollamaBaseUrl,
    ollamaModel,
  }
}

/** Determine which provider to use based on configuration and available keys */
export async function resolveActiveAiConfig(
  overrideProvider?: AiProviderType,
  overrideModel?: string
): Promise<AiResolvedConfig> {
  const config = await getAiConfig()
  let targetProvider = overrideProvider || config.provider

  if (targetProvider === 'auto') {
    if (config.openRouterApiKey) {
      targetProvider = 'openrouter'
    } else if (config.geminiApiKey) {
      targetProvider = 'gemini'
    } else {
      targetProvider = 'ollama'
    }
  }

  if (targetProvider === 'openrouter') {
    return {
      provider: 'openrouter',
      model: overrideModel || config.openRouterModel,
      apiKey: config.openRouterApiKey,
      baseUrl: 'https://openrouter.ai/api/v1',
    }
  }

  if (targetProvider === 'gemini') {
    return {
      provider: 'gemini',
      model: overrideModel || config.geminiModel,
      apiKey: config.geminiApiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    }
  }

  // Default to Ollama
  return {
    provider: 'ollama',
    model: overrideModel || config.ollamaModel,
    baseUrl: config.ollamaBaseUrl,
  }
}

// ============================================================================
// CHAT COMPLETIONS
// ============================================================================

/** Main unified chat completion entry point */
export async function aiChat(
  messages: AiMessage[],
  opts: AiChatOptions = {}
): Promise<string> {
  const config = await resolveActiveAiConfig(opts.provider, opts.model)

  if (config.provider === 'openrouter') {
    return openRouterChat(messages, config, opts)
  }

  if (config.provider === 'gemini') {
    return geminiChat(messages, config, opts)
  }

  return ollamaChatInternal(messages, config, opts)
}

/** OpenRouter Chat Completion via OpenAI-compatible endpoint */
async function openRouterChat(
  messages: AiMessage[],
  config: AiResolvedConfig,
  opts: AiChatOptions
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('OpenRouter API key is not configured. Please add your key in Settings.')
  }

  const body: any = {
    model: config.model,
    messages,
    temperature: opts.temperature ?? 0.7,
  }

  if (opts.format === 'json') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://lexilearn.ai',
      'X-Title': 'LexiLearn AI Mentor',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    try {
      const errJson = JSON.parse(errText)
      throw new Error(`OpenRouter error (${res.status}): ${errJson.error?.message || errText}`)
    } catch (e: any) {
      if (e.message.startsWith('OpenRouter error')) throw e
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText || res.statusText}`)
    }
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** Google Gemini Chat Completion via REST API */
async function geminiChat(
  messages: AiMessage[],
  config: AiResolvedConfig,
  opts: AiChatOptions
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Google Gemini API key is not configured. Please add your key in Settings.')
  }

  // Separate system message from conversation contents
  const systemMsg = messages.find((m) => m.role === 'system')
  const nonSystemMsgs = messages.filter((m) => m.role !== 'system')

  // Convert to Gemini contents format
  const contents = nonSystemMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  // If contents is empty, ensure at least one turn
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] })
  }

  const body: any = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
    },
  }

  if (systemMsg) {
    body.systemInstruction = {
      parts: [{ text: systemMsg.content }],
    }
  }

  if (opts.format === 'json') {
    body.generationConfig.responseMimeType = 'application/json'
  }

  const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    try {
      const errJson = JSON.parse(errText)
      throw new Error(`Gemini error (${res.status}): ${errJson.error?.message || errText}`)
    } catch (e: any) {
      if (e.message.startsWith('Gemini error')) throw e
      throw new Error(`Gemini HTTP ${res.status}: ${errText || res.statusText}`)
    }
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/** Ollama Chat Completion */
async function ollamaChatInternal(
  messages: AiMessage[],
  config: AiResolvedConfig,
  opts: AiChatOptions
): Promise<string> {
  const body: any = {
    model: config.model,
    messages,
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.7,
    },
  }
  if (opts.format === 'json') {
    body.format = 'json'
  }

  const res = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`)
  }

  const data = await res.json()
  return data.message?.content ?? ''
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

export async function aiEmbed(
  input: string | string[],
  model?: string
): Promise<number[][]> {
  const config = await resolveActiveAiConfig()
  const textArray = Array.isArray(input) ? input : [input]

  if (config.provider === 'gemini' && config.apiKey) {
    try {
      const embedModel = 'text-embedding-004'
      const results: number[][] = []
      for (const text of textArray) {
        const url = `${config.baseUrl}/models/${embedModel}:embedContent?key=${config.apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text }] },
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) {
          const d = await res.json()
          if (d.embedding?.values) results.push(d.embedding.values)
        }
      }
      if (results.length === textArray.length) return results
    } catch {
      // Fallback
    }
  }

  if (config.provider === 'openrouter' && config.apiKey) {
    try {
      const embedModel = 'openai/text-embedding-3-small'
      const res = await fetch(`${config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: embedModel,
          input: textArray,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.data?.length) return d.data.map((x: any) => x.embedding)
      }
    } catch {
      // Fallback
    }
  }

  // Default to Ollama embeddings
  try {
    const embedModel =
      model ||
      (typeof process !== 'undefined' && process.env.OLLAMA_EMBED_MODEL) ||
      'nomic-embed-text-v2-moe'
    const res = await fetch(`${config.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: embedModel, input }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) {
      const data = await res.json()
      return (data.embeddings || []) as number[][]
    }
  } catch {
    // Graceful fallback
  }

  return []
}

// ============================================================================
// STATUS & CONNECTION TEST
// ============================================================================

export async function checkAiStatus(): Promise<AiStatus> {
  const config = await resolveActiveAiConfig()

  if (config.provider === 'openrouter') {
    if (!config.apiKey) {
      return {
        available: false,
        provider: 'openrouter',
        model: config.model,
        models: POPULAR_MODELS.openrouter.map((m) => m.id),
        error: 'OpenRouter API key is not configured',
      }
    }
    try {
      const res = await fetch(`${config.baseUrl}/auth/key`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        return {
          available: true,
          provider: 'openrouter',
          model: config.model,
          models: POPULAR_MODELS.openrouter.map((m) => m.id),
        }
      }
      return {
        available: false,
        provider: 'openrouter',
        model: config.model,
        models: POPULAR_MODELS.openrouter.map((m) => m.id),
        error: `OpenRouter authorization failed (HTTP ${res.status})`,
      }
    } catch (e: any) {
      return {
        available: false,
        provider: 'openrouter',
        model: config.model,
        models: POPULAR_MODELS.openrouter.map((m) => m.id),
        error: e.message || 'Cannot reach OpenRouter',
      }
    }
  }

  if (config.provider === 'gemini') {
    if (!config.apiKey) {
      return {
        available: false,
        provider: 'gemini',
        model: config.model,
        models: POPULAR_MODELS.gemini.map((m) => m.id),
        error: 'Google Gemini API key is not configured',
      }
    }
    try {
      const res = await fetch(`${config.baseUrl}/models?key=${config.apiKey}`, {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        const geminiModels = (data.models || [])
          .map((m: any) => m.name.replace(/^models\//, ''))
          .filter((name: string) => name.startsWith('gemini'))
        return {
          available: true,
          provider: 'gemini',
          model: config.model,
          models: geminiModels.length > 0 ? geminiModels : POPULAR_MODELS.gemini.map((m) => m.id),
        }
      }
      return {
        available: false,
        provider: 'gemini',
        model: config.model,
        models: POPULAR_MODELS.gemini.map((m) => m.id),
        error: `Gemini API key verification failed (HTTP ${res.status})`,
      }
    } catch (e: any) {
      return {
        available: false,
        provider: 'gemini',
        model: config.model,
        models: POPULAR_MODELS.gemini.map((m) => m.id),
        error: e.message || 'Cannot reach Google Gemini',
      }
    }
  }

  // Ollama
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      return {
        available: false,
        provider: 'ollama',
        model: config.model,
        models: [],
        error: `Ollama returned HTTP ${res.status}`,
      }
    }
    const data = await res.json()
    const models = (data.models || []).map((m: any) => m.name as string)
    return {
      available: true,
      provider: 'ollama',
      model: config.model,
      models,
    }
  } catch (e: any) {
    return {
      available: false,
      provider: 'ollama',
      model: config.model,
      models: [],
      error: e?.message || 'Ollama is not running locally',
    }
  }
}

/** Test an explicit API configuration submitted from the UI */
export async function testAiConnection(params: {
  provider: 'ollama' | 'openrouter' | 'gemini'
  apiKey?: string
  model?: string
  baseUrl?: string
}): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const model = params.model || DEFAULT_MODELS[params.provider]

    if (params.provider === 'openrouter') {
      if (!params.apiKey?.trim()) {
        return { ok: false, message: 'Please provide an OpenRouter API key.' }
      }
      const testRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${params.apiKey.trim()}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!testRes.ok) {
        const text = await testRes.text().catch(() => '')
        return { ok: false, message: `Invalid OpenRouter API key (HTTP ${testRes.status}): ${text}` }
      }
      const data = await testRes.json()
      const label = data.data?.label || 'OpenRouter Key'
      return { ok: true, message: `Connected to OpenRouter successfully (${label})!`, model }
    }

    if (params.provider === 'gemini') {
      if (!params.apiKey?.trim()) {
        return { ok: false, message: 'Please provide a Google Gemini API key.' }
      }
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${params.apiKey.trim()}`,
        { signal: AbortSignal.timeout(10_000) }
      )
      if (!testRes.ok) {
        const text = await testRes.text().catch(() => '')
        return { ok: false, message: `Invalid Gemini API key (HTTP ${testRes.status}): ${text}` }
      }
      return { ok: true, message: 'Connected to Google Gemini successfully!', model }
    }

    if (params.provider === 'ollama') {
      const base = (params.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '')
      const testRes = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!testRes.ok) {
        return { ok: false, message: `Ollama returned HTTP ${testRes.status}` }
      }
      const data = await testRes.json()
      const models = (data.models || []).map((m: any) => m.name)
      return {
        ok: true,
        message: `Connected to local Ollama! (${models.length} model(s) available)`,
        model: models[0] || model,
      }
    }

    return { ok: false, message: 'Unknown AI provider' }
  } catch (e: any) {
    return { ok: false, message: `Connection failed: ${e.message || 'Network error'}` }
  }
}
