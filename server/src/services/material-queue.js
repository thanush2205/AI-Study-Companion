import { Queue } from 'bullmq'
import Redis from 'ioredis'
import env from '../config/env.js'

const queueName = 'material-processing'
const connection = env.redisUrl ? new Redis(env.redisUrl, { maxRetriesPerRequest: null }) : null
const materialQueue = connection ? new Queue(queueName, { connection }) : null

export async function enqueueMaterialJob({ jobId, materialId }) {
  if (!materialQueue) throw new Error('REDIS_URL is required to enqueue material jobs')
  await materialQueue.add('process-material', { jobId: jobId.toString(), materialId: materialId.toString() }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  })
}

export { connection, queueName }
