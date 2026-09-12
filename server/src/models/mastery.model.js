import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const masteryHistorySchema = new mongoose.Schema({
  previousMastery: { type: Number, required: true },
  performance: { type: Number, required: true },
  newMastery: { type: Number, required: true },
  source: { type: String, enum: ['quiz', 'assessment', 'manual', 'system'], required: true },
  referenceId: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const masterySchema = new mongoose.Schema({
  ...projectFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  conceptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept', required: true, index: true },
  score: { type: Number, min: 0, max: 1, default: 0 },
  currentMastery: { type: Number, min: 0, max: 1, default: 0 },
  previousMastery: { type: Number, min: 0, max: 1, default: 0 },
  attempts: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  history: { type: [masteryHistorySchema], default: [] },
  level: { type: String, enum: ['novice', 'developing', 'proficient', 'mastered'], default: 'novice' },
  evidence: [{ type: String }],
  updatedBy: { type: String, enum: ['assessment', 'manual', 'system'], default: 'assessment' },
}, timestamps)

masterySchema.index({ projectId: 1, userId: 1, conceptId: 1 }, { unique: true })
export default registerModel('Mastery', masterySchema)
