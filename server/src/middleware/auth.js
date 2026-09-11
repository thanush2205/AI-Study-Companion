import mongoose from 'mongoose'
import { User } from '../models/index.js'
import { verifyToken } from '../services/auth.service.js'

export async function authenticate(request, response, next) {
  const authorization = request.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) return response.status(401).json({ error: 'Authentication required' })

  try {
    const payload = verifyToken(token)
    if (!mongoose.isValidObjectId(payload.sub)) return response.status(401).json({ error: 'Invalid token' })

    const user = await User.findById(payload.sub).select('_id email name role avatarUrl').lean()
    if (!user) return response.status(401).json({ error: 'User no longer exists' })

    request.user = user
    return next()
  } catch {
    return response.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'ADMIN') return response.status(403).json({ error: 'Admin access required' })
  return next()
}
