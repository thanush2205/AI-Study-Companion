import express from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { getGlobalAnalytics } from '../services/analytics.service.js'
import { getAIUsageSummary, getSystemHealth, getUserDetail, listUsers } from '../services/admin.service.js'

const router = express.Router()
const adminOnly = [authenticate, requireAdmin]

router.get('/status', adminOnly, async (_request, response) => {
  response.json({ status: 'ok', area: 'admin' })
})

router.get('/analytics/global', adminOnly, async (_request, response, next) => {
  try {
    const analytics = await getGlobalAnalytics()
    return response.json({ analytics })
  } catch (error) {
    return next(error)
  }
})

router.get('/overview', adminOnly, async (_request, response, next) => {
  try {
    const [health, aiUsage] = await Promise.all([getSystemHealth(), getAIUsageSummary()])
    return response.json({ health, aiUsage })
  } catch (error) {
    return next(error)
  }
})

router.get('/system/health', adminOnly, async (_request, response, next) => {
  try {
    const health = await getSystemHealth()
    return response.json({ health })
  } catch (error) {
    return next(error)
  }
})

router.get('/ai-usage', adminOnly, async (_request, response, next) => {
  try {
    const aiUsage = await getAIUsageSummary()
    return response.json({ aiUsage })
  } catch (error) {
    return next(error)
  }
})

router.get('/users', adminOnly, async (request, response, next) => {
  try {
    const result = await listUsers({ page: request.query.page, limit: request.query.limit, search: request.query.search })
    return response.json(result)
  } catch (error) {
    return next(error)
  }
})

router.get('/users/:userId', adminOnly, async (request, response, next) => {
  try {
    const detail = await getUserDetail(request.params.userId)
    return response.json(detail)
  } catch (error) {
    return next(error)
  }
})

export default router