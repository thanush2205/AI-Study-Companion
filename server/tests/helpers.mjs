import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import '../src/models/index.js'
import { createToken, hashPassword } from '../src/services/auth.service.js'
import { generateEmbedding } from '../src/services/embedding.service.js'

const here = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(here, '../../.env') })

export const BASE = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000'

export async function connect() {
  const { default: mongoose } = await import('mongoose')
  await mongoose.connect(process.env.MONGODB_URI)
  return mongoose
}

export async function createUser(mongoose, { email, name = 'Test User', role = 'USER' } = {}) {
  const user = await mongoose.models.User.create({
    email,
    name,
    role,
    passwordHash: await hashPassword('password123'),
  })
  return { id: user._id.toString(), _id: user._id, role, token: createToken(user) }
}

export function createSpace(mongoose, userId, name = 'Test Space') {
  return mongoose.models.Space.create({ userId, name })
}

export function createProject(mongoose, userId, spaceId, overrides = {}) {
  return mongoose.models.Project.create({ userId, spaceId, title: 'Test Project', type: 'text', ...overrides })
}

export async function createConcept(mongoose, projectId, name, description = '') {
  return mongoose.models.Concept.create({ projectId, name, description })
}

export async function seedMaterialChunks(mongoose, projectId, texts, materialTitle = 'Seed Material') {
  const material = await mongoose.models.Material.create({
    projectId,
    uploadedBy: projectId,
    title: materialTitle,
    type: 'text',
    processingStatus: 'READY',
  })
  const chunks = []
  for (const [chunkIndex, text] of texts.entries()) {
    chunks.push(await mongoose.models.Chunk.create({
      projectId,
      materialId: material._id,
      chunkIndex,
      text,
      content: text,
      pageNumber: 1,
      tokenCount: text.split(/\s+/).length,
      embedding: generateEmbedding(text),
    }))
  }
  return { material, chunks }
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) })
  const text = await response.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: response.status, json }
}