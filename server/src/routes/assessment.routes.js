import express from 'express'
import { Assessment } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireAssessmentAccess } from '../middleware/assessment-access.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { evaluateOpenAssessment } from '../services/assessment-engine.js'

const router = express.Router()

router.post('/projects/:projectId/assessments', authenticate, requireProjectAccess, async (request, response, next) => {
  try {
    const { conceptId, question, answer } = request.body
    if (!conceptId || !question?.trim() || !answer?.trim()) return response.status(400).json({ error: 'conceptId, question, and answer are required' })
    const result = await evaluateOpenAssessment({ projectId: request.scope.projectId, userId: request.user._id, conceptId, question: question.trim(), answer: answer.trim() })
    return response.status(201).json({ projectId: request.scope.projectId, ...result })
  } catch (error) {
    return next(error)
  }
})

router.get('/assessments/:id', authenticate, requireAssessmentAccess, (request, response) => {
  response.json({ assessment: request.assessment })
})

export default router
