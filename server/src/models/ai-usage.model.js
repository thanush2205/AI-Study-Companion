import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const aiUsageSchema = new mongoose.Schema({
  ...projectFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  provider: { type: String, required: true },
  model: { type: String, required: true },
  operation: { type: String, required: true },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  success: { type: Boolean, default: true },
  error: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

aiUsageSchema.index({ projectId: 1, createdAt: -1 })
export default registerModel('AIUsage', aiUsageSchema)
