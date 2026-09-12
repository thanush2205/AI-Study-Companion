import mongoose from 'mongoose'
import { registerModel, timestamps } from './_shared.js'

const aiEvaluationSchema = new mongoose.Schema({
  caseId: { type: String, required: true, index: true },
  category: { type: String, enum: ['supported', 'unsupported'], required: true, index: true },
  question: { type: String, required: true },
  expected: { type: String, enum: ['grounded-answer', 'refusal'], required: true },
  actual: { type: String, enum: ['grounded-answer', 'refusal'], required: true },
  grounded: { type: Boolean, default: false },
  cited: { type: Boolean, default: false },
  refused: { type: Boolean, default: false },
  correct: { type: Boolean, default: false },
  evidenceCount: { type: Number, default: 0 },
  provider: { type: String, default: null },
  model: { type: String, default: null },
  latencyMs: { type: Number, default: 0 },
  error: { type: String, default: null },
  runId: { type: String, index: true },
}, timestamps)

aiEvaluationSchema.index({ runId: 1, createdAt: -1 })
export default registerModel('AIEvaluation', aiEvaluationSchema)