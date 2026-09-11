import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const chunkSchema = new mongoose.Schema({
  ...projectFields,
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  content: { type: String, required: true },
  pageNumber: Number,
  tokenCount: Number,
  embedding: { type: [Number], select: false },
}, timestamps)

chunkSchema.index({ materialId: 1, chunkIndex: 1 }, { unique: true })
export default registerModel('Chunk', chunkSchema)
