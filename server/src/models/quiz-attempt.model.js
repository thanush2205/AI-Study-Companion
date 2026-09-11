import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const quizAttemptSchema = new mongoose.Schema({
  ...projectFields,
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  answers: [{ questionId: mongoose.Schema.Types.ObjectId, answer: String, correct: Boolean }],
  score: { type: Number, min: 0, max: 1 },
  completedAt: Date,
}, timestamps)

quizAttemptSchema.index({ projectId: 1, userId: 1, createdAt: -1 })
export default registerModel('QuizAttempt', quizAttemptSchema)
