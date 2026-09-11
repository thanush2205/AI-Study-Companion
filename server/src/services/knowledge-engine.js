import { Chunk, Conversation, Material, Message } from '../models/index.js'
import { cosineSimilarity, generateEmbedding } from './embedding.service.js'
import { AIService } from './ai-provider-router.js'

const retrievalLimit = 5
const evidenceThreshold = 0.18

export async function retrieveEvidence({ projectId, question }) {
  const queryEmbedding = generateEmbedding(question)
  const chunks = await Chunk.find({ projectId }).select('+embedding text content pageNumber chunkIndex materialId').lean()
  const scored = chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .filter((chunk) => chunk.score >= evidenceThreshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, retrievalLimit)

  return { queryEmbedding, evidence: scored }
}

function refusal(question) {
  return {
    answer: `I cannot answer "${question}" from this project's study material. Add a relevant source or ask about something covered in the uploaded documents.`,
    refused: true,
    citations: [],
  }
}

function groundedAnswer(evidence) {
  const citations = evidence.map((chunk, index) => ({
    index: index + 1,
    chunkId: chunk._id,
    materialId: chunk.materialId,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    quote: chunk.text ?? chunk.content,
    score: Number(chunk.score.toFixed(4)),
  }))
  const answer = evidence.map((chunk, index) => `[${index + 1}] ${chunk.text ?? chunk.content}`).join('\n\n')
  return { answer, refused: false, citations, provider: 'extractive-fallback' }
}

export async function answerQuestion({ projectId, userId, question, conversationId }) {
  const { evidence } = await retrieveEvidence({ projectId, question })
  let result = evidence.length ? groundedAnswer(evidence) : refusal(question)

  if (evidence.length) {
    const context = evidence.map((chunk, index) => `[${index + 1}] ${chunk.text ?? chunk.content}`).join('\n\n')
    try {
      const generated = await AIService.generate({
        projectId,
        userId,
        operation: 'tutor-answer',
        instructions: 'Answer only from the supplied study excerpts. Be concise. If the excerpts do not support the answer, say that the material is insufficient. Preserve citation markers like [1].',
        input: `Question: ${question}\n\nStudy excerpts:\n${context}`,
      })
      result = { ...result, answer: generated.text, provider: generated.provider, model: generated.model }
    } catch {
      // The extractive answer remains grounded when no provider is configured or both fail.
    }
  }
  const conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, projectId, userId })
    : await Conversation.create({ projectId, userId, title: question.slice(0, 80) })

  if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  await Message.create({ projectId, conversationId: conversation._id, role: 'user', content: question })
  const assistantMessage = await Message.create({
    projectId,
    conversationId: conversation._id,
    role: 'assistant',
    content: result.answer,
    citations: result.citations.map((citation) => ({ chunkId: citation.chunkId, quote: citation.quote, pageNumber: citation.pageNumber })),
    metadata: { grounded: !result.refused, evidenceCount: evidence.length, evidenceThreshold, provider: result.provider, model: result.model },
  })

  return { conversationId: conversation._id, messageId: assistantMessage._id, ...result, evidenceCount: evidence.length }
}

export { evidenceThreshold }
