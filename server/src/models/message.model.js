import mongoose from 'mongoose'
import { projectFields, registerModel, timestamps } from './_shared.js'

const messageSchema = new mongoose.Schema({
  ...projectFields,
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  citations: [{ chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' }, quote: String, pageNumber: Number }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

messageSchema.index({ projectId: 1, conversationId: 1, createdAt: 1 })
export default registerModel('Message', messageSchema)
