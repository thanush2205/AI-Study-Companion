import { Chunk, Conversation, Material, Message } from '../models/index.js'
import { cosineSimilarity, generateEmbedding, generateQueryEmbedding } from './embedding.service.js'
import { AIService } from './ai-provider-router.js'
import { buildTutorContext } from './learning-context.service.js'
import { EVENTS, recordEvent } from './event.service.js'

const retrievalLimit = 5
const evidenceThreshold = 0.18

export async function retrieveEvidence({ projectId, question }) {
  const queryEmbedding = generateQueryEmbedding(question)
  const chunks = await Chunk.find({ projectId }).select('+embedding text content pageNumber chunkIndex materialId').lean()
  const scored = chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .filter((chunk) => chunk.score >= evidenceThreshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, retrievalLimit)

  const materialIds = scored.map((chunk) => chunk.materialId)
  const materials = await Material.find({ _id: { $in: materialIds }, projectId }).select('_id title').lean()
  const materialTitles = new Map(materials.map((material) => [material._id.toString(), material.title]))
  return { queryEmbedding, evidence: scored.map((chunk) => ({ ...chunk, materialTitle: materialTitles.get(chunk.materialId.toString()) ?? 'Study material' })) }
}

function refusal(question) {
  return {
    answer: `I couldn't find enough evidence about this in the learning materials for this project. Try asking about concepts covered in your uploaded materials.`,
    refused: true,
    citations: [],
  }
}

function groundedAnswer(evidence) {
  const citations = evidence.map((chunk, index) => ({
    index: index + 1,
    chunkId: chunk._id,
    materialId: chunk.materialId,
    materialTitle: chunk.materialTitle,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    quote: chunk.text ?? chunk.content,
    score: Number(chunk.score.toFixed(4)),
  }))
  const answer = evidence.map((chunk, index) => `[${index + 1}] ${chunk.text ?? chunk.content}`).join('\n\n')
  return { answer, refused: false, citations, provider: 'extractive-fallback' }
}

function appendSources(answer, citations) {
  const sources = citations.map((citation) => `${citation.index}. ${citation.materialTitle} — Page ${citation.pageNumber ?? 'unknown'}`).join('\n')
  return `${answer.trim()}\n\nSources:\n${sources}`
}

export async function answerQuestion({ projectId, userId, question, conversationId }) {
  const { evidence } = await retrieveEvidence({ projectId, question })
  const tutorContext = await buildTutorContext({ projectId, userId, conversationId })
  let result = evidence.length ? groundedAnswer(evidence) : refusal(question)

  if (evidence.length) {
    const context = evidence.map((chunk, index) => `[${index + 1}] ${chunk.text ?? chunk.content}`).join('\n\n')
    const learnerContext = JSON.stringify(tutorContext)
    try {
      const generated = await AIService.generate({
        projectId,
        userId,
        operation: 'tutor-answer',
        instructions: 'You are a grounded study tutor. Answer only from the supplied study excerpts. Use project, learner, assessment, and conversation context to tailor the explanation, but never invent facts beyond the excerpts. Be concise and preserve citation markers like [1]. If evidence is insufficient, explicitly say so.',
        input: `Question: ${question}\n\nLearning context:\n${learnerContext}\n\nStudy excerpts:\n${context}`,
      })
      result = { ...result, answer: appendSources(generated.text, result.citations), provider: generated.provider, model: generated.model }
    } catch {
      // The extractive answer remains grounded when no provider is configured or both fail.
    }
  }
  if (!result.refused && result.provider === 'extractive-fallback') result.answer = appendSources(result.answer, result.citations)
  const conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, projectId, userId })
    : await Conversation.create({ projectId, userId, title: question.slice(0, 80) })

  if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  await Message.create({ projectId, conversationId: conversation._id, role: 'user', content: question })
  await recordEvent({
    type: EVENTS.TUTOR_QUESTION,
    projectId,
    userId,
    entityType: 'Conversation',
    entityId: conversation._id,
    metadata: { question: question.slice(0, 200), conversationId: conversation._id },
  })
  const assistantMessage = await Message.create({
    projectId,
    conversationId: conversation._id,
    role: 'assistant',
    content: result.answer,
    citations: result.citations.map((citation) => ({ chunkId: citation.chunkId, quote: citation.quote, pageNumber: citation.pageNumber })),
    metadata: { grounded: !result.refused, evidenceCount: evidence.length, evidenceThreshold, provider: result.provider, model: result.model },
  })
  await recordEvent({
    type: EVENTS.TUTOR_RESPONSE,
    projectId,
    userId,
    entityType: 'Message',
    entityId: assistantMessage._id,
    metadata: { conversationId: conversation._id, grounded: !result.refused, provider: result.provider ?? null },
  })

  return {
    conversationId: conversation._id,
    messageId: assistantMessage._id,
    responseType: result.refused ? 'refusal' : 'grounded-answer',
    confidence: evidence.length ? Number(Math.max(...evidence.map((item) => item.score)).toFixed(4)) : 0,
    ...result,
    evidenceCount: evidence.length,
  }
}

export { evidenceThreshold }
