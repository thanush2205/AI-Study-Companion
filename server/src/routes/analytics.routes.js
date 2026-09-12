import express from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { getGlobalAnalytics } from '../services/analytics.service.js'

const router = express.Router()

router.get('/admin/analytics/global', authenticate, requireAdmin, async (_request, response, next) => {
  try {
    const analytics = await getGlobalAnalytics()
    return response.json({ analytics })
  } catch (error) {
    return next(error)
  }
})

export default router