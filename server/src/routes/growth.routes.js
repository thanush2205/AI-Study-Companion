import express from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { getGrowthAnalysis } from '../services/growth-analysis.js'

const router = express.Router()
const growthAccess = [authenticate, requireProjectAccess]

router.get('/projects/:projectId/growth', growthAccess, async (request, response, next) => {
  try {
    const analysis = await getGrowthAnalysis({ projectId: request.scope.projectId, userId: request.user._id })
    return response.json({ projectId: request.scope.projectId, ...analysis })
  } catch (error) {
    return next(error)
  }
})

export default router