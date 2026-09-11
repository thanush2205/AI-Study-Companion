import mongoose from 'mongoose'
import { registerModel, timestamps } from './_shared.js'

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  spaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: String,
  learningGoal: String,
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

projectSchema.index({ userId: 1, spaceId: 1 })
export default registerModel('Project', projectSchema)
