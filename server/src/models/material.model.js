import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const materialSchema = new mongoose.Schema({
  ...projectFields,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['pdf', 'document', 'text', 'url'], required: true },
  sourceUrl: String,
  storageKey: String,
  processingStatus: { type: String, enum: ['UPLOADED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'], default: 'UPLOADED' },
  processingError: String,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

materialSchema.index({ projectId: 1, processingStatus: 1 })
export default registerModel('Material', materialSchema)
