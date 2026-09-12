import mongoose from 'mongoose'
import { objectId, registerModel, timestamps } from './_shared.js'

const activitySchema = new mongoose.Schema({
  projectId: { type: objectId(), ref: 'Project', index: true, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'SPACE_CREATED', 'PROJECT_CREATED', 'PROJECT_ACCESSED',
      'MATERIAL_UPLOADED', 'MATERIAL_PROCESSED',
      'TUTOR_QUESTION', 'TUTOR_RESPONSE',
      'QUIZ_STARTED', 'QUIZ_ANSWERED', 'QUIZ_COMPLETED',
      'ASSESSMENT_COMPLETED', 'MASTERY_UPDATED', 'RECOMMENDATION_GENERATED',
    ],
    required: true,
  },
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, timestamps)

activitySchema.index({ projectId: 1, userId: 1, createdAt: -1 })
export default registerModel('Activity', activitySchema)
