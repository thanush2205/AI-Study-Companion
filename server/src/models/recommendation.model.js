import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const recommendationSchema = new mongoose.Schema({
  ...projectFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['review', 'quiz', 'material', 'study-plan', 'tutor'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['new', 'accepted', 'dismissed', 'completed'], default: 'new' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

recommendationSchema.index({ projectId: 1, userId: 1, status: 1 })
export default registerModel('Recommendation', recommendationSchema)
