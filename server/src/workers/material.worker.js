import mongoose from 'mongoose'
import { Worker } from 'bullmq'
import env from '../config/env.js'
import { processMaterial } from '../services/material-processor.js'
import { connection, queueName } from '../services/material-queue.js'

if (!env.mongoUri || !connection) {
  throw new Error('MONGODB_URI and REDIS_URL are required to run the material worker')
}

await mongoose.connect(env.mongoUri)
console.log('Material worker connected to MongoDB')

const worker = new Worker(queueName, async (job) => {
  await processMaterial(job.data.materialId, job.data.jobId)
}, { connection, concurrency: 2 })

worker.on('completed', (job) => console.log(`Material job ${job.id} completed`))
worker.on('failed', (job, error) => console.error(`Material job ${job?.id} failed:`, error.message))

async function shutdown() {
  await worker.close()
  await connection.quit()
  await mongoose.disconnect()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)