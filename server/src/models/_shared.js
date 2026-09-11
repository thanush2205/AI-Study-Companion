import mongoose from 'mongoose'

export const objectId = () => mongoose.Schema.Types.ObjectId

export const projectFields = {
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
}

export const timestamps = { timestamps: true }

export function registerModel(name, schema) {
  return mongoose.models[name] ?? mongoose.model(name, schema)
}
