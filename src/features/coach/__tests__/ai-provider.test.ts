import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MODELS,
  POPULAR_MODELS,
  testAiConnection,
} from '@/features/coach/server/ai-provider'

describe('AI Provider configuration and testing', () => {
  it('has valid default models configured for all providers', () => {
    expect(DEFAULT_MODELS.ollama).toBe('qwen3:8b')
    expect(DEFAULT_MODELS.openrouter).toBe('google/gemini-2.5-flash')
    expect(DEFAULT_MODELS.gemini).toBe('gemini-2.5-flash')
  })

  it('provides popular models list for UI selectors', () => {
    expect(POPULAR_MODELS.openrouter.length).toBeGreaterThan(0)
    expect(POPULAR_MODELS.gemini.length).toBeGreaterThan(0)
    expect(POPULAR_MODELS.ollama.length).toBeGreaterThan(0)
  })

  it('rejects empty API keys for OpenRouter and Gemini during connection test', async () => {
    const resOr = await testAiConnection({ provider: 'openrouter', apiKey: '' })
    expect(resOr.ok).toBe(false)
    expect(resOr.message).toContain('OpenRouter API key')

    const resGem = await testAiConnection({ provider: 'gemini', apiKey: '' })
    expect(resGem.ok).toBe(false)
    expect(resGem.message).toContain('Google Gemini API key')
  })
})
