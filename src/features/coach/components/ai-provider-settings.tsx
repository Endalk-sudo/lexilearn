'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Key,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Server,
  Zap,
} from 'lucide-react'
import { api, type Settings } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export const POPULAR_MODELS = {
  openrouter: [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Cheap)' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (High Quality)' },
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

interface AiProviderSettingsProps {
  onSaved?: () => void
  compact?: boolean
}

export function AiProviderSettingsForm({ onSaved, compact = false }: AiProviderSettingsProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showOrKey, setShowOrKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  const [provider, setProvider] = useState<'auto' | 'ollama' | 'openrouter' | 'gemini'>('auto')
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false)
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.5-flash')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [hasGeminiKey, setHasGeminiKey] = useState(false)
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://127.0.0.1:11434')
  const [ollamaModel, setOllamaModel] = useState('qwen3:8b')

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const s = await api.getSettings()
      if (s.aiProvider) setProvider(s.aiProvider)
      if (s.openRouterApiKey !== undefined) setOpenRouterApiKey(s.openRouterApiKey)
      setHasOpenRouterKey(!!s.hasOpenRouterKey)
      if (s.openRouterModel) setOpenRouterModel(s.openRouterModel)
      if (s.geminiApiKey !== undefined) setGeminiApiKey(s.geminiApiKey)
      setHasGeminiKey(!!s.hasGeminiKey)
      if (s.geminiModel) setGeminiModel(s.geminiModel)
      if (s.ollamaBaseUrl) setOllamaBaseUrl(s.ollamaBaseUrl)
      if (s.ollamaModel) setOllamaModel(s.ollamaModel)
    } catch {
      toast.error('Could not load AI settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const effectiveProvider = provider === 'auto'
    ? (hasOpenRouterKey || openRouterApiKey.trim() ? 'openrouter' : hasGeminiKey || geminiApiKey.trim() ? 'gemini' : 'ollama')
    : provider

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const targetProvider = effectiveProvider
      const apiKey = targetProvider === 'openrouter' ? openRouterApiKey : geminiApiKey
      const model = targetProvider === 'openrouter' ? openRouterModel : targetProvider === 'gemini' ? geminiModel : ollamaModel
      const baseUrl = targetProvider === 'ollama' ? ollamaBaseUrl : undefined

      const res = await api.testAiConnection({
        provider: targetProvider,
        apiKey: apiKey.trim(),
        model: model.trim(),
        baseUrl: baseUrl?.trim(),
      })
      setTestResult(res)
      if (res.ok) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Test failed' })
      toast.error('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateSettings({
        aiProvider: provider,
        openRouterApiKey,
        openRouterModel,
        geminiApiKey,
        geminiModel,
        ollamaBaseUrl,
        ollamaModel,
      })
      toast.success('AI Mentor preferences saved!')
      onSaved?.()
      await loadSettings()
    } catch {
      toast.error('Could not save AI preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading AI settings...</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-5', compact ? 'text-sm' : '')}>
      {/* Provider Selector */}
      <div className="space-y-1.5">
        <Label htmlFor="ai-provider" className="font-medium">
          Active Provider
        </Label>
        <Select
          value={provider}
          onValueChange={(val) => {
            setProvider(val as any)
            setTestResult(null)
          }}
        >
          <SelectTrigger id="ai-provider" className="w-full">
            <SelectValue placeholder="Choose provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <span className="font-medium">Auto-Detect</span>
              <span className="text-xs text-muted-foreground ml-2">(OpenRouter → Gemini → Ollama)</span>
            </SelectItem>
            <SelectItem value="openrouter">
              <span className="font-medium">OpenRouter</span>
              <span className="text-xs text-muted-foreground ml-2">(Claude, GPT-4o, Llama 3, DeepSeek)</span>
            </SelectItem>
            <SelectItem value="gemini">
              <span className="font-medium">Google Gemini</span>
              <span className="text-xs text-muted-foreground ml-2">(Gemini 2.5 Flash, 1.5 Pro)</span>
            </SelectItem>
            <SelectItem value="ollama">
              <span className="font-medium">Local Ollama</span>
              <span className="text-xs text-muted-foreground ml-2">(100% Offline & Private)</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {provider === 'auto'
            ? 'Automatically picks OpenRouter or Gemini if an API key is present; otherwise falls back to local Ollama.'
            : provider === 'openrouter'
            ? 'Uses OpenRouter to connect to models from OpenAI, Anthropic, Meta, DeepSeek, and Google with one key.'
            : provider === 'gemini'
            ? 'Connects directly to Google Generative AI API using your Google Gemini API key.'
            : 'Runs completely on your local machine via Ollama with zero internet dependency.'}
        </p>
      </div>

      {/* Provider-specific settings */}
      {/* 1. OpenRouter Section */}
      {(provider === 'openrouter' || provider === 'auto') && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">OpenRouter Configuration</span>
            </div>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Get API Key <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="or-key" className="text-xs flex items-center justify-between">
              <span>API Key</span>
              {hasOpenRouterKey && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                  ✓ Configured
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="or-key"
                type={showOrKey ? 'text' : 'password'}
                placeholder={hasOpenRouterKey ? '••••••••••••••••' : 'sk-or-v1-...'}
                value={openRouterApiKey}
                onChange={(e) => setOpenRouterApiKey(e.target.value)}
                className="pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowOrKey(!showOrKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle OpenRouter key visibility"
              >
                {showOrKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="or-model" className="text-xs">Model</Label>
            <Select
              value={
                POPULAR_MODELS.openrouter.some((m) => m.id === openRouterModel)
                  ? openRouterModel
                  : 'custom'
              }
              onValueChange={(val) => {
                if (val !== 'custom') setOpenRouterModel(val)
              }}
            >
              <SelectTrigger id="or-model" className="w-full text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {POPULAR_MODELS.openrouter.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs">Custom Model Name...</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={openRouterModel}
              onChange={(e) => setOpenRouterModel(e.target.value)}
              placeholder="e.g. google/gemini-2.5-flash"
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
      )}

      {/* 2. Google Gemini Section */}
      {(provider === 'gemini' || (provider === 'auto' && !openRouterApiKey && !hasOpenRouterKey)) && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Google Gemini Configuration</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Get Free API Key <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gemini-key" className="text-xs flex items-center justify-between">
              <span>API Key</span>
              {hasGeminiKey && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                  ✓ Configured
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="gemini-key"
                type={showGeminiKey ? 'text' : 'password'}
                placeholder={hasGeminiKey ? '••••••••••••••••' : 'AIzaSy...'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle Gemini key visibility"
              >
                {showGeminiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gemini-model" className="text-xs">Model</Label>
            <Select
              value={
                POPULAR_MODELS.gemini.some((m) => m.id === geminiModel)
                  ? geminiModel
                  : 'custom'
              }
              onValueChange={(val) => {
                if (val !== 'custom') setGeminiModel(val)
              }}
            >
              <SelectTrigger id="gemini-model" className="w-full text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {POPULAR_MODELS.gemini.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs">Custom Model Name...</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              placeholder="e.g. gemini-2.5-flash"
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
      )}

      {/* 3. Ollama Section */}
      {(provider === 'ollama' || (provider === 'auto' && !hasOpenRouterKey && !openRouterApiKey && !hasGeminiKey && !geminiApiKey)) && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Local Ollama Configuration</span>
            </div>
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              ollama.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ollama-url" className="text-xs">Server URL</Label>
              <Input
                id="ollama-url"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ollama-model" className="text-xs">Model Tag</Label>
              <Input
                id="ollama-model"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="qwen3:8b"
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Test Result Banner */}
      {testResult && (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-md p-3 text-xs border',
            testResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive-foreground'
          )}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          )}
          <div className="flex-1 font-medium">{testResult.message}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={testing || saving}
          className="gap-1.5 text-xs"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
          Test Connection
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving || testing}
          className="gap-1.5 text-xs"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}

export function AiProviderModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Mentor Setup
          </DialogTitle>
          <DialogDescription>
            Configure your preferred AI engine: OpenRouter (Claude, GPT, Llama, DeepSeek), Google Gemini, or local Ollama.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <AiProviderSettingsForm
            compact
            onSaved={() => {
              onSaved?.()
              onOpenChange(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
