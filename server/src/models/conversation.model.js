import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const conversationSchema = new mongoose.Schema({
  ...projectFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  summary: { type: String, trim: true },
  summaryUpdatedAt: Date,
}, timestamps)

conversationSchema.index({ projectId: 1, userId: 1, updatedAt: -1 })
export default registerModel('Conversation', conversationSchema)
