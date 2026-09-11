import mongoose from 'mongoose'
import { registerModel, timestamps } from './_shared.js'

const spaceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: String,
  color: String,
  archivedAt: Date,
}, timestamps)

spaceSchema.index({ userId: 1, name: 1 })
export default registerModel('Space', spaceSchema)
