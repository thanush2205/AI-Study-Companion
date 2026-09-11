import mongoose from 'mongoose'
import { Material, Project, Space } from '../models/index.js'

export async function requireMaterialAccess(request, response, next) {
  const { id } = request.params
  if (!mongoose.isValidObjectId(id)) return response.status(400).json({ error: 'A valid material id is required' })

  const material = await Material.findById(id).lean()
  if (!material) return response.status(404).json({ error: 'Material not found' })

  const project = await Project.findOne({ _id: material.projectId, userId: request.user._id }).select('_id spaceId').lean()
  if (!project) return response.status(404).json({ error: 'Material not found' })

  const space = await Space.findOne({ _id: project.spaceId, userId: request.user._id }).select('_id').lean()
  if (!space) return response.status(404).json({ error: 'Material not found' })

  request.material = material
  request.scope = { userId: request.user._id, spaceId: space._id, projectId: project._id }
  return next()
}