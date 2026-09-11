import env from '../config/env.js'
import { AIUsage } from '../models/index.js'

function providerError(provider, message) {
  const error = new Error(`${provider}: ${message}`)
  error.provider = provider
  return error
}

function readOpenAIText(payload) {
  if (payload.output_text) return payload.output_text
  return payload.output?.flatMap((item) => item.content ?? [])
    ?.map((item) => item.text ?? '')
    .join('')
    .trim()
}

function readGeminiText(payload) {
  const steps = payload.steps ?? payload.output ?? []
  return steps.flatMap((item) => item.content ?? [])
    ?.map((item) => item.text ?? item?.text?.value ?? '')
    .join('')
    .trim() || payload.text?.trim()
}

async function openAIProvider({ instructions, input, model = env.openaiModel }) {
  if (!env.openaiApiKey) throw providerError('openai', 'OPENAI_API_KEY is not configured')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions, input }),
  })
  const payload = await response.json()
  if (!response.ok) throw providerError('openai', payload.error?.message ?? `HTTP ${response.status}`)
  const text = readOpenAIText(payload)
  if (!text) throw providerError('openai', 'Provider returned no text')
  return { text, provider: 'openai', model, usage: payload.usage }
}

async function geminiProvider({ instructions, input, model = env.geminiModel }) {
  if (!env.geminiApiKey) throw providerError('gemini', 'GEMINI_API_KEY is not configured')
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
    body: JSON.stringify({ model, system_instruction: instructions, input }),
  })
  const payload = await response.json()
  if (!response.ok) throw providerError('gemini', payload.error?.message ?? `HTTP ${response.status}`)
  const text = readGeminiText(payload)
  if (!text) throw providerError('gemini', 'Provider returned no text')
  return { text, provider: 'gemini', model, usage: payload.usage }
}

async function recordUsage({ projectId, userId, operation, result }) {
  if (!projectId || !result) return
  try {
    await AIUsage.create({
      projectId,
      userId,
      provider: result.provider,
      model: result.model,
      operation,
      inputTokens: result.usage?.input_tokens ?? result.usage?.prompt_token_count ?? 0,
      outputTokens: result.usage?.output_tokens ?? result.usage?.candidates_token_count ?? 0,
      metadata: { router: 'openai-primary-gemini-fallback' },
    })
  } catch (error) {
    console.error('AI usage recording failed:', error.message)
  }
}

export const AIService = {
  async generate({ instructions, input, projectId, userId, operation = 'generate' }) {
    let primaryError
    try {
      const result = await openAIProvider({ instructions, input })
      await recordUsage({ projectId, userId, operation, result })
      return result
    } catch (error) {
      primaryError = error
    }

    try {
      const result = await geminiProvider({ instructions, input })
      await recordUsage({ projectId, userId, operation, result })
      return result
    } catch (fallbackError) {
      const error = new Error('All configured AI providers failed')
      error.primaryError = primaryError
      error.fallbackError = fallbackError
      throw error
    }
  },
}

export { geminiProvider, openAIProvider }
