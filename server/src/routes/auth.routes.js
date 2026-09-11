import express from 'express'
import { User } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { createToken, hashPassword, publicUser, verifyPassword } from '../services/auth.service.js'

const router = express.Router()

router.post('/register', async (request, response, next) => {
  try {
    const { email, name, password } = request.body
    if (!email || !name || !password || password.length < 8) {
      return response.status(400).json({ error: 'name, email, and a password of at least 8 characters are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await User.exists({ email: normalizedEmail })
    if (existingUser) return response.status(409).json({ error: 'Email is already registered' })

    const user = await User.create({
      email: normalizedEmail,
      name: name.trim(),
      passwordHash: await hashPassword(password),
    })

    return response.status(201).json({ user: publicUser(user), token: createToken(user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body
    const user = await User.findOne({ email: email?.trim().toLowerCase() }).select('+passwordHash')
    if (!user || !(await verifyPassword(password ?? '', user.passwordHash))) {
      return response.status(401).json({ error: 'Invalid email or password' })
    }

    return response.json({ user: publicUser(user), token: createToken(user) })
  } catch (error) {
    return next(error)
  }
})

router.get('/me', authenticate, (request, response) => {
  response.json({ user: publicUser(request.user) })
})

export default router
