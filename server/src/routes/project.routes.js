import express from 'express'
import { Activity, Conversation, Material, Project, Quiz } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireProjectAccess } from '../middleware/project-access.js'

const router = express.Router()
const projectAccess = [authenticate, requireProjectAccess]

router.patch('/:projectId', projectAccess, async (request, response, next) => {
  try {
    const updates = {}
    for (const field of ['title', 'description', 'learningGoal', 'status']) {
      if (request.body[field] !== undefined) updates[field] = field === 'title' ? request.body[field].trim() : request.body[field]
    }
    if (updates.title === '') return response.status(400).json({ error: 'Project title cannot be empty' })

    const project = await Project.findOneAndUpdate(
      { _id: request.scope.projectId, userId: request.user._id, spaceId: request.scope.spaceId },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean()
    return response.json({ project })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:projectId', projectAccess, async (request, response, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: request.scope.projectId, userId: request.user._id, spaceId: request.scope.spaceId },
      { $set: { status: 'archived' } },
      { new: true },
    ).lean()
    return response.json({ project })
  } catch (error) {
    return next(error)
  }
})

router.get('/:projectId', projectAccess, (request, response) => {
  response.json({ project: request.project })
})

router.get('/:projectId/materials', projectAccess, async (request, response, next) => {
  try {
    const materials = await Material.find({ projectId: request.scope.projectId }).sort({ createdAt: -1 }).lean()
    return response.json({ projectId: request.scope.projectId, materials })
  } catch (error) {
    return next(error)
  }
})

router.get('/:projectId/conversations', projectAccess, async (request, response, next) => {
  try {
    const conversations = await Conversation.find({ projectId: request.scope.projectId, userId: request.user._id })
      .sort({ updatedAt: -1 })
      .lean()
    return response.json({ projectId: request.scope.projectId, conversations })
  } catch (error) {
    return next(error)
  }
})

router.get('/:projectId/quizzes', projectAccess, async (request, response, next) => {
  try {
    const quizzes = await Quiz.find({ projectId: request.scope.projectId }).sort({ createdAt: -1 }).lean()
    return response.json({ projectId: request.scope.projectId, quizzes })
  } catch (error) {
    return next(error)
  }
})

router.get('/:projectId/analytics', projectAccess, async (request, response, next) => {
  try {
    const activity = await Activity.find({ projectId: request.scope.projectId, userId: request.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    return response.json({ projectId: request.scope.projectId, activity })
  } catch (error) {
    return next(error)
  }
})

export default router
