import env from '../config/env.js'
import { AIUsage } from '../models/index.js'

function providerError(provider, message) {
  const error = new Error(`${provider}: ${message}`)
  error.provider = provider
  return error
}

function readGroqText(payload) {
  return payload.choices?.[0]?.message?.content?.trim()
}

function readGeminiText(payload) {
  const steps = payload.steps ?? payload.output ?? []
  return steps.flatMap((item) => item.content ?? [])
    ?.map((item) => item.text ?? item?.text?.value ?? '')
    .join('')
    .trim() || payload.text?.trim()
}

async function groqProvider({ instructions, input, model = env.groqModel }) {
  if (!env.groqApiKey) throw providerError('groq', 'GROQ_API_KEY is not configured')
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }] }),
  })
  const payload = await response.json()
  if (!response.ok) throw providerError('groq', payload.error?.message ?? `HTTP ${response.status}`)
  const text = readGroqText(payload)
  if (!text) throw providerError('groq', 'Provider returned no text')
  return { text, provider: 'groq', model, usage: payload.usage }
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
      inputTokens: result.usage?.prompt_tokens ?? result.usage?.input_tokens ?? result.usage?.prompt_token_count ?? 0,
      outputTokens: result.usage?.completion_tokens ?? result.usage?.output_tokens ?? result.usage?.candidates_token_count ?? 0,
      metadata: { router: 'groq-primary-gemini-fallback' },
    })
  } catch (error) {
    console.error('AI usage recording failed:', error.message)
  }
}

export const AIService = {
  async generate({ instructions, input, projectId, userId, operation = 'generate' }) {
    let primaryError
    try {
      const result = await groqProvider({ instructions, input })
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

export { geminiProvider, groqProvider }
