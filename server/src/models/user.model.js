import mongoose from 'mongoose'
import { registerModel, timestamps } from './_shared.js'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  avatarUrl: String,
  lastActiveAt: Date,
}, timestamps)

export default registerModel('User', userSchema)
