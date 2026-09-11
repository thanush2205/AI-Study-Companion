import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(currentDirectory, '../../../.env') })
dotenv.config({ path: resolve(currentDirectory, '../../.env') })

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'local-development-only-change-me',
  mongoUri: process.env.MONGODB_URI ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
}

export default env
