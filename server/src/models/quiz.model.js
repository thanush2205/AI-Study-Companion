import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  type: { type: String, enum: ['multiple-choice', 'short-answer', 'true-false'], required: true },
  options: [String],
  answer: String,
  explanation: String,
  conceptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept' },
}, { _id: true })

const quizSchema = new mongoose.Schema({
  ...projectFields,
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
  conceptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Concept' }],
  title: { type: String, required: true, trim: true },
  questions: { type: [questionSchema], default: [] },
  generationStatus: { type: String, enum: ['draft', 'ready', 'failed'], default: 'draft' },
}, timestamps)

quizSchema.index({ projectId: 1, createdAt: -1 })
export default registerModel('Quiz', quizSchema)
