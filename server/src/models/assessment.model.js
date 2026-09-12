import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const assessmentSchema = new mongoose.Schema({
  ...projectFields,
  quizAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assessmentType: { type: String, enum: ['quiz', 'open-ended'], default: 'quiz', index: true },
  conceptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept', index: true },
  question: String,
  answer: String,
  score: { type: Number, min: 0, max: 1 },
  correctPoints: [String],
  missingPoints: [String],
  misconceptions: [String],
  feedback: String,
  masteryImpact: { type: Number, min: -1, max: 1 },
  summary: { type: String, default: '' },
  strengths: [String],
  gaps: [String],
}, timestamps)

assessmentSchema.index({ projectId: 1, userId: 1, createdAt: -1 })
export default registerModel('Assessment', assessmentSchema)
