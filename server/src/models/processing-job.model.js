import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const processingJobSchema = new mongoose.Schema({
  ...projectFields,
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'QUEUED', index: true },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  attempts: { type: Number, default: 0 },
  error: String,
  startedAt: Date,
  completedAt: Date,
}, timestamps)

processingJobSchema.index({ projectId: 1, materialId: 1, createdAt: -1 })
export default registerModel('ProcessingJob', processingJobSchema)
