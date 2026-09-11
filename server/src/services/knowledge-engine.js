import { Assessment, Chunk, Concept, Conversation, Material, Mastery, Message, Project } from '../models/index.js'
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
  const [project, materials, concepts, mastery, assessments, history] = await Promise.all([
    Project.findById(projectId).select('title description learningGoal status').lean(),
    Material.find({ projectId, processingStatus: 'READY' }).select('title type metadata').limit(20).lean(),
    Concept.find({ projectId }).select('name description').limit(40).lean(),
    Mastery.find({ projectId, userId }).select('conceptId score level evidence').limit(40).lean(),
    Assessment.find({ projectId, userId }).sort({ createdAt: -1 }).select('summary strengths gaps createdAt').limit(5).lean(),
    conversationId ? Message.find({ conversationId, projectId }).sort({ createdAt: -1 }).limit(12).select('role content').lean() : Promise.resolve([]),
  ])
  let result = evidence.length ? groundedAnswer(evidence) : refusal(question)

  if (evidence.length) {
    const context = evidence.map((chunk, index) => `[${index + 1}] ${chunk.text ?? chunk.content}`).join('\n\n')
    const learnerContext = JSON.stringify({ project, materials, concepts, mastery, assessments, conversationHistory: history.reverse() })
    try {
      const generated = await AIService.generate({
        projectId,
        userId,
        operation: 'tutor-answer',
        instructions: 'You are a grounded study tutor. Answer only from the supplied study excerpts. Use project, learner, assessment, and conversation context to tailor the explanation, but never invent facts beyond the excerpts. Be concise and preserve citation markers like [1]. If evidence is insufficient, explicitly say so.',
        input: `Question: ${question}\n\nLearning context:\n${learnerContext}\n\nStudy excerpts:\n${context}`,
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
