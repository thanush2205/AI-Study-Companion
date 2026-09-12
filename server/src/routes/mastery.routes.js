import express from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireProjectAccess } from '../middleware/project-access.js'
import { getMasterySnapshot } from '../services/mastery-engine.js'

const router = express.Router()
const masteryAccess = [authenticate, requireProjectAccess]

router.get('/projects/:projectId/mastery', masteryAccess, async (request, response, next) => {
  try {
    const mastery = await getMasterySnapshot({ projectId: request.scope.projectId, userId: request.user._id })
    return response.json({ projectId: request.scope.projectId, mastery })
  } catch (error) {
    return next(error)
  }
})

export default router