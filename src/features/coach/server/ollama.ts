import {
  aiChat,
  aiEmbed,
  checkAiStatus,
  resolveActiveAiConfig,
  type AiMessage,
  type AiChatOptions,
  type AiStatus,
  DEFAULT_MODELS,
  POPULAR_MODELS,
} from './ai-provider'

export type OllamaMessage = AiMessage
export type OllamaChatOptions = AiChatOptions

export { DEFAULT_MODELS, POPULAR_MODELS }

export function getConfiguredModel(): string {
  if (typeof process !== 'undefined' && process.env.OLLAMA_MODEL) {
    return process.env.OLLAMA_MODEL
  }
  return DEFAULT_MODELS.ollama
}

export async function getActiveModel(): Promise<string> {
  const cfg = await resolveActiveAiConfig()
  return cfg.model
}

/** Vector embeddings for RAG knowledge base */
export async function ollamaEmbed(
  input: string | string[],
  model?: string
): Promise<number[][]> {
  return aiEmbed(input, model)
}

/** Check reachability & active provider status */
export async function checkOllamaStatus(): Promise<AiStatus> {
  return checkAiStatus()
}

/** AI Chat completion via active provider (OpenRouter, Gemini, or Ollama) */
export async function ollamaChat(
  messages: OllamaMessage[],
  opts: OllamaChatOptions = {}
): Promise<string> {
  return aiChat(messages, opts)
}

/** Streaming chat completion fallback */
export async function* ollamaChatStream(
  messages: OllamaMessage[],
  opts: OllamaChatOptions = {}
): AsyncGenerator<string> {
  // Yield the completed output chunk
  const response = await aiChat(messages, opts)
  yield response
}

// ---------- Mentor system prompts ----------

export const MENTOR_SYSTEM = `You are LexiLearn Mentor, a patient, precise, and encouraging English teacher.
Your students are often intermediate learners (B1–C1) who may also speak Amharic.
Goals:
- Help them acquire accurate, natural English.
- Correct gently but clearly.
- Prefer short, high-signal explanations over long lectures.
- When useful, give a brief Amharic gloss for key corrections or difficult concepts.
- Never invent words or facts. If unsure, say so.
- Focus on practical usage, collocations, and register.
Tone: warm, serious about learning, lightly energetic — never condescending.`

export function buildPracticePrompt(opts: {
  words: { word: string; definition?: string; amharic?: string }[]
  type: 'cloze' | 'rewrite' | 'error_correction' | 'use_in_paragraph' | 'discussion'
  count?: number
  level?: string
}): string {
  const wordList = opts.words
    .map((w) => `- ${w.word}${w.definition ? `: ${w.definition}` : ''}${w.amharic ? ` (አማርኛ: ${w.amharic})` : ''}`)
    .join('\n')
  const n = opts.count ?? 5
  const level = opts.level || 'B2'

  const typeInstructions: Record<string, string> = {
    cloze: `Create ${n} cloze (fill-in-the-blank) sentences that force the learner to use the target words. Provide the answer key at the end.`,
    rewrite: `Create ${n} sentences that contain unnatural or incorrect usage related to the target words. Ask the learner to rewrite them more naturally. Provide model answers.`,
    error_correction: `Create ${n} short sentences that each contain one clear error (grammar, collocation, or word choice) involving the target vocabulary. Ask the learner to correct them. Show the corrected versions and short explanations.`,
    use_in_paragraph: `Ask the learner to write a short coherent paragraph (80–120 words) that naturally uses at least ${Math.min(5, opts.words.length)} of the target words. Then provide a model paragraph and feedback points.`,
    discussion: `Create ${n} thought-provoking discussion questions that naturally invite the use of the target words. Keep them suitable for self-study or conversation practice.`,
  }

  return `Target vocabulary (CEFR ~${level}):
${wordList}

Task: ${typeInstructions[opts.type] || typeInstructions.cloze}

Format your response clearly with numbered items. Keep language natural and at the indicated level.`
}

export function buildWritingFeedbackPrompt(text: string, targetWords?: string[]): string {
  const targets = targetWords?.length
    ? `\nThe learner was encouraged to use these words: ${targetWords.join(', ')}.`
    : ''
  return `Please review the following English writing from a learner.${targets}

Writing:
"""
${text}
"""

Respond with:
1. **Overall impression** (1–2 sentences)
2. **Corrected version** (full corrected text)
3. **Key corrections** (bullet list: original → better form + short reason). Include Amharic gloss for the most important 2–3 points if helpful.
4. **Vocabulary & collocation tips** (if relevant)
5. **One concrete next step** the learner should practice

Be encouraging but precise.`
}

export function buildConversationSystem(scenario: string, targetWords?: string[]): string {
  const vocab = targetWords?.length
    ? `\nGently encourage the student to use these words when natural: ${targetWords.join(', ')}.`
    : ''
  return `${MENTOR_SYSTEM}

You are role-playing a conversation partner in this scenario: ${scenario}.${vocab}
- Keep turns relatively short so the student can respond.
- After every 3–4 student turns, or when they ask, give a brief correction summary.
- Stay in character but remain a helpful teacher.`
}

export function buildExplainPrompt(query: string, context?: string): string {
  return `The learner asks: "${query}"
${context ? `Context: ${context}` : ''}

Give a clear, accurate, practical explanation suitable for an intermediate English learner.
If relevant, compare similar expressions, give 2–3 natural example sentences, and add a short Amharic gloss for the core idea.
Keep the whole answer concise (under 250 words unless the question is complex).`
}

