import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const conceptSchema = new mongoose.Schema({
  ...projectFields,
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', index: true },
  name: { type: String, required: true, trim: true },
  description: String,
  sourceChunkIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' }],
}, timestamps)

conceptSchema.index({ projectId: 1, name: 1 }, { unique: true })
export default registerModel('Concept', conceptSchema)
