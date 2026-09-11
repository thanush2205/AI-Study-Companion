import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import env from '../config/env.js'

const tokenOptions = { expiresIn: '7d' }

export function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

export function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, tokenOptions)
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

export function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  }
}
