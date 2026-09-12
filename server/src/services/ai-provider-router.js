import env from '../config/env.js'
import { AIUsage } from '../models/index.js'

const providerError = (provider, message) => {
  const error = new Error(`${provider}: ${message}`)
  error.provider = provider
  return error
}

const readGroqText = (payload) => payload.choices?.[0]?.message?.content?.trim()
const readGeminiText = (payload) => {
  const steps = payload.steps ?? payload.output ?? []
  return steps.flatMap((item) => item.content ?? [])
    ?.map((item) => item.text ?? item?.text?.value ?? '')
    .join('')
    .trim() || payload.text?.trim()
}

const tokenCount = (usage) => ({
  input: usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.prompt_token_count ?? 0,
  output: usage?.completion_tokens ?? usage?.output_tokens ?? usage?.candidates_token_count ?? 0,
})

const pricing = {
  'openai/gpt-oss-120b': { input: 0.15, output: 0.60 },
  'gemini-3.6-flash': { input: 0.075, output: 0.30 },
}

function estimateCost(model, inputTokens, outputTokens) {
  const { input, output } = pricing[model] ?? pricing['openai/gpt-oss-120b']
  return (inputTokens * input + outputTokens * output) / 1_000_000
}

async function persistUsage(record) {
  try {
    await AIUsage.create(record)
  } catch (error) {
    console.error('AI usage recording failed:', error.message)
  }
}

async function executeProvider({ projectId, userId, operation, provider, model, call }) {
  const started = performance.now()
  try {
    const result = await call()
    const latencyMs = Math.round(performance.now() - started)
    const { input: inputTokens, output: outputTokens } = tokenCount(result.usage)
    await persistUsage({ projectId, userId, operation, provider, model, inputTokens, outputTokens, cost: Number(estimateCost(model, inputTokens, outputTokens).toFixed(8)), latencyMs, success: true })
    return { ...result, latencyMs }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started)
    await persistUsage({ projectId, userId, operation, provider, model, latencyMs, success: false, error: String(error.message ?? error).slice(0, 500) })
    throw error
  }
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

export const AIService = {
  async generate({ instructions, input, projectId, userId, operation = 'generate' }) {
    let primaryError
    try {
      return await executeProvider({ projectId, userId, operation, provider: 'groq', model: env.groqModel, call: () => groqProvider({ instructions, input }) })
    } catch (error) { primaryError = error }

    try {
      return await executeProvider({ projectId, userId, operation, provider: 'gemini', model: env.geminiModel, call: () => geminiProvider({ instructions, input }) })
    } catch (fallbackError) {
      const error = new Error('All configured AI providers failed')
      error.primaryError = primaryError
      error.fallbackError = fallbackError
      throw error
    }
  },
}

export { geminiProvider, groqProvider, estimateCost }