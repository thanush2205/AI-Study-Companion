import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import Redis from 'ioredis'
import env from './config/env.js'
import projectRouter from './routes/project.routes.js'

const app = express()
const redis = env.redisUrl ? new Redis(env.redisUrl, { lazyConnect: true }) : null

app.use(helmet())
app.use(cors({ origin: env.clientOrigin }))
app.use(express.json())
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.use('/api/projects', projectRouter)

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'study-companion-api', timestamp: new Date().toISOString() })
})

app.get('/api/ready', (_request, response) => {
  const mongoReady = mongoose.connection.readyState === 1
  const redisConfigured = Boolean(redis)
  const redisReady = redis?.status === 'ready'

  response.status(mongoReady && (!redisConfigured || redisReady) ? 200 : 503).json({
    status: mongoReady && (!redisConfigured || redisReady) ? 'ready' : 'degraded',
    dependencies: {
      mongodb: env.mongoUri ? (mongoReady ? 'connected' : 'disconnected') : 'not-configured',
      redis: redisConfigured ? (redisReady ? 'connected' : 'disconnected') : 'not-configured',
    },
  })
})

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(env.port, () => {
  console.log(`Study Companion API listening on http://localhost:${env.port}`)
})

async function connectOptionalServices() {
  if (env.mongoUri) {
    await mongoose.connect(env.mongoUri)
    console.log('MongoDB connected')
  }

  if (redis) {
    await redis.connect()
    console.log('Redis connected')
  }
}

connectOptionalServices().catch((error) => {
  console.error('Optional service connection failed:', error.message)
})

function shutdown() {
  server.close()
  if (redis) redis.disconnect()
  if (mongoose.connection.readyState !== 0) mongoose.disconnect()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
