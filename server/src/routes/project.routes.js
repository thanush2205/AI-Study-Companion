import express from 'express'
import { Material } from '../models/index.js'
import { requireProjectScope } from '../middleware/project-scope.js'

const router = express.Router()

router.get('/:projectId/materials', requireProjectScope, async (request, response, next) => {
  try {
    const materials = await Material.find({ projectId: request.scope.projectId }).sort({ createdAt: -1 }).lean()
    return response.json({ projectId: request.scope.projectId, materials })
  } catch (error) {
    return next(error)
  }
})

export default router
