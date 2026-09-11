import express from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'

const router = express.Router()

router.get('/status', authenticate, requireAdmin, (_request, response) => {
  response.json({ status: 'ok', area: 'admin' })
})

export default router
