import express from 'express'
import multer from 'multer'
import { Activity, Conversation, Material, Project, Quiz } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { processMaterial } from '../services/material-processor.js'

const router = express.Router()
const projectAccess = [authenticate, requireProjectAccess]
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
})

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

router.post('/:projectId/materials', projectAccess, upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'A PDF file is required in the file field' })

    const material = await Material.create({
      projectId: request.scope.projectId,
      uploadedBy: request.user._id,
      title: request.body.title?.trim() || request.file.originalname.replace(/\.pdf$/i, ''),
      type: 'pdf',
      processingStatus: 'QUEUED',
      metadata: { originalName: request.file.originalname, mimeType: request.file.mimetype, size: request.file.size },
    })

    setImmediate(() => processMaterial(material._id, request.file.buffer))
    return response.status(202).json({ material })
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
