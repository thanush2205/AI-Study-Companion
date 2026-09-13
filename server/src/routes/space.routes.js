import express from 'express'
import { Project, Space } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireSpaceAccess } from '../middleware/space-access.js'
import { EVENTS, recordEvent } from '../services/event.service.js'

const router = express.Router()

router.use(authenticate)

router.post('/', async (request, response, next) => {
  try {
    const { name, description, color } = request.body
    if (!name?.trim()) return response.status(400).json({ error: 'Space name is required' })

    const space = await Space.create({ userId: request.user._id, name: name.trim(), description, color })
    await recordEvent({ type: EVENTS.SPACE_CREATED, userId: request.user._id, entityType: 'Space', entityId: space._id, metadata: { name: space.name } })
    return response.status(201).json({ space })
  } catch (error) {
    return next(error)
  }
})

router.get('/', async (request, response, next) => {
  try {
    const spaces = await Space.aggregate([
      { $match: { userId: request.user._id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'projects',
          let: { spaceId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$spaceId', '$$spaceId'] }, status: 'active' } },
            { $count: 'count' },
          ],
          as: '_counts',
        },
      },
      { $set: { projectCount: { $ifNull: [{ $arrayElemAt: ['$_counts.count', 0] }, 0] } } },
      { $unset: '_counts' },
    ])
    return response.json({ spaces })
  } catch (error) {
    return next(error)
  }
})

router.get('/:id', async (request, response, next) => {
  try {
    const space = await Space.findOne({ _id: request.params.id, userId: request.user._id }).lean()
    if (!space) return response.status(404).json({ error: 'Space not found' })
    return response.json({ space })
  } catch (error) {
    return next(error)
  }
})

router.patch('/:id', async (request, response, next) => {
  try {
    const updates = {}
    for (const field of ['name', 'description', 'color', 'archivedAt']) {
      if (request.body[field] !== undefined) updates[field] = field === 'name' ? request.body[field].trim() : request.body[field]
    }
    if (updates.name === '') return response.status(400).json({ error: 'Space name cannot be empty' })

    const space = await Space.findOneAndUpdate(
      { _id: request.params.id, userId: request.user._id },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean()
    if (!space) return response.status(404).json({ error: 'Space not found' })
    return response.json({ space })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', async (request, response, next) => {
  try {
    const space = await Space.findOneAndUpdate(
      { _id: request.params.id, userId: request.user._id },
      { $set: { archivedAt: new Date() } },
      { new: true },
    ).lean()
    if (!space) return response.status(404).json({ error: 'Space not found' })
    return response.json({ space })
  } catch (error) {
    return next(error)
  }
})

router.post('/:spaceId/projects', requireSpaceAccess, async (request, response, next) => {
  try {
    const { title, description, learningGoal, status } = request.body
    if (!title?.trim()) return response.status(400).json({ error: 'Project title is required' })

    const project = await Project.create({
      title: title.trim(),
      description,
      learningGoal,
      status,
      spaceId: request.space._id,
      userId: request.user._id,
    })
    await recordEvent({ type: EVENTS.PROJECT_CREATED, projectId: project._id, userId: request.user._id, entityType: 'Project', entityId: project._id, metadata: { title: project.title, spaceId: project.spaceId } })
    return response.status(201).json({ project })
  } catch (error) {
    return next(error)
  }
})

router.get('/:spaceId/projects', requireSpaceAccess, async (request, response, next) => {
  try {
    const projects = await Project.find({ spaceId: request.space._id, userId: request.user._id })
      .sort({ createdAt: -1 })
      .lean()
    return response.json({ projects })
  } catch (error) {
    return next(error)
  }
})

export default router
