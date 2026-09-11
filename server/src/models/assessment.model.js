import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const assessmentSchema = new mongoose.Schema({
  ...projectFields,
  quizAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  summary: { type: String, required: true },
  strengths: [String],
  gaps: [String],
}, timestamps)

assessmentSchema.index({ projectId: 1, userId: 1, createdAt: -1 })
export default registerModel('Assessment', assessmentSchema)
