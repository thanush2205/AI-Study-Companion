import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const activitySchema = new mongoose.Schema({
  ...projectFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

activitySchema.index({ projectId: 1, userId: 1, createdAt: -1 })
export default registerModel('Activity', activitySchema)
