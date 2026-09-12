import express from 'express'
import multer from 'multer'
import { Activity, Conversation, Material, ProcessingJob, Project, Quiz } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { enqueueMaterialJob } from '../services/material-queue.js'
import { saveMaterialFile } from '../services/material-storage.js'
import { answerQuestion } from '../services/knowledge-engine.js'
import { generateAdaptiveQuiz, publicQuiz } from '../services/quiz-engine.js'
import { getProjectAnalytics } from '../services/analytics.service.js'
import { EVENTS, recordEvent } from '../services/event.service.js'

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
  recordEvent({ type: EVENTS.PROJECT_ACCESSED, projectId: request.scope.projectId, userId: request.user._id, entityType: 'Project', entityId: request.scope.projectId }).catch(() => {})
  response.json({ project: request.project })
})

router.post('/:projectId/tutor/ask', projectAccess, async (request, response, next) => {
  try {
    const { question, conversationId } = request.body
    if (!question?.trim()) return response.status(400).json({ error: 'A question is required' })

    const result = await answerQuestion({
      projectId: request.scope.projectId,
      userId: request.user._id,
      question: question.trim(),
      conversationId,
    })
    return response.json({ projectId: request.scope.projectId, ...result })
  } catch (error) {
    return next(error)
  }
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
      processingStatus: 'UPLOADED',
      metadata: { originalName: request.file.originalname, mimeType: request.file.mimetype, size: request.file.size },
    })

    const storageKey = await saveMaterialFile(material._id, request.file.buffer)
    const job = await ProcessingJob.create({ projectId: material.projectId, materialId: material._id })
    await Material.findByIdAndUpdate(material._id, { storageKey, processingStatus: 'QUEUED' })
    try {
      await enqueueMaterialJob({ jobId: job._id, materialId: material._id })
    } catch (error) {
      await Promise.all([
        Material.findByIdAndUpdate(material._id, { processingStatus: 'FAILED', processingError: error.message }),
        ProcessingJob.findByIdAndUpdate(job._id, { status: 'FAILED', error: error.message, completedAt: new Date() }),
      ])
      return response.status(503).json({ error: 'Material processing queue is unavailable' })
    }

    const queuedMaterial = await Material.findById(material._id).lean()
    await recordEvent({ type: EVENTS.MATERIAL_UPLOADED, projectId: material.projectId, userId: request.user._id, entityType: 'Material', entityId: material._id, metadata: { title: material.title, size: request.file.size } })
    return response.status(202).json({ material: queuedMaterial, job })
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

router.post('/:projectId/quizzes', projectAccess, async (request, response, next) => {
  try {
    const quiz = await generateAdaptiveQuiz({ projectId: request.scope.projectId, userId: request.user._id, count: request.body.count })
    return response.status(201).json({ quiz: publicQuiz(quiz) })
  } catch (error) {
    return next(error)
  }
})

router.get('/:projectId/analytics', projectAccess, async (request, response, next) => {
  try {
    const analytics = await getProjectAnalytics({ projectId: request.scope.projectId, userId: request.user._id })
    return response.json({ projectId: request.scope.projectId, analytics, activity: analytics.activity.recent })
  } catch (error) {
    return next(error)
  }
})

export default router
