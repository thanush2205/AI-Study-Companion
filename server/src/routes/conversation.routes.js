import express from 'express'
import { Conversation, Message } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireConversationAccess } from '../middleware/conversation-access.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { answerQuestion } from '../services/knowledge-engine.js'

const router = express.Router()
const conversationAccess = [authenticate, requireConversationAccess]

router.post('/projects/:projectId/conversations', authenticate, requireProjectAccess, async (request, response, next) => {
  try {
    const { projectId } = request.params
    const { title } = request.body
    const conversation = await Conversation.create({ projectId, userId: request.user._id, title: title?.trim() || 'New study session' })
    return response.status(201).json({ conversation })
  } catch (error) {
    return next(error)
  }
})

router.post('/conversations/:conversationId/messages', conversationAccess, async (request, response, next) => {
  try {
    const { question } = request.body
    if (!question?.trim()) return response.status(400).json({ error: 'A question is required' })

    const result = await answerQuestion({
      projectId: request.scope.projectId,
      userId: request.user._id,
      question: question.trim(),
      conversationId: request.conversation._id,
    })
    return response.json({ projectId: request.scope.projectId, ...result })
  } catch (error) {
    return next(error)
  }
})

router.get('/conversations/:id', conversationAccess, async (request, response, next) => {
  try {
    const messages = await Message.find({ conversationId: request.conversation._id, projectId: request.scope.projectId })
      .sort({ createdAt: 1 })
      .lean()
    return response.json({ conversation: request.conversation, project: request.project, messages })
  } catch (error) {
    return next(error)
  }
})

export default router
