import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const masterySchema = new mongoose.Schema({
  ...projectFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  conceptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept', required: true, index: true },
  score: { type: Number, min: 0, max: 1, default: 0 },
  level: { type: String, enum: ['novice', 'developing', 'proficient', 'mastered'], default: 'novice' },
  evidence: [{ type: String }],
  updatedBy: { type: String, enum: ['assessment', 'manual', 'system'], default: 'assessment' },
}, timestamps)

masterySchema.index({ projectId: 1, userId: 1, conceptId: 1 }, { unique: true })
export default registerModel('Mastery', masterySchema)
