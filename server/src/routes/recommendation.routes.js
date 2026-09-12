import express from 'express'
import { Recommendation } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { generateRecommendations } from '../services/recommendation-engine.js'

const router = express.Router()
const recommendationAccess = [authenticate, requireProjectAccess]

router.post('/projects/:projectId/recommendations/generate', recommendationAccess, async (request, response, next) => {
  try {
    const result = await generateRecommendations({ projectId: request.scope.projectId, userId: request.user._id })
    return response.status(201).json({ projectId: request.scope.projectId, ...result })
  } catch (error) {
    return next(error)
  }
})

router.get('/projects/:projectId/recommendations', recommendationAccess, async (request, response, next) => {
  try {
    const pending = await Recommendation.find({ projectId: request.scope.projectId, userId: request.user._id, status: 'new' })
      .sort({ createdAt: -1 })
      .lean()
    if (pending.length) {
      return response.json({ projectId: request.scope.projectId, recommendations: pending })
    }
    const result = await generateRecommendations({ projectId: request.scope.projectId, userId: request.user._id })
    return response.json({ projectId: request.scope.projectId, ...result })
  } catch (error) {
    return next(error)
  }
})

router.post('/recommendations/:id/:action', authenticate, async (request, response, next) => {
  try {
    const action = request.params.action
    if (!['accept', 'dismiss', 'complete'].includes(action)) return response.status(400).json({ error: 'action must be accept, dismiss, or complete' })
    const status = { accept: 'accepted', dismiss: 'dismissed', complete: 'completed' }[action]
    const recommendation = await Recommendation.findOneAndUpdate(
      { _id: request.params.id, userId: request.user._id },
      { $set: { status } },
      { new: true },
    ).lean()
    if (!recommendation) return response.status(404).json({ error: 'Recommendation not found' })
    return response.json({ recommendation })
  } catch (error) {
    return next(error)
  }
})

export default router