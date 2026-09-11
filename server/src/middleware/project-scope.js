import mongoose from 'mongoose'
import { Project, Space, User } from '../models/index.js'

export async function requireProjectScope(request, response, next) {
  const userId = request.get('x-user-id')
  const { projectId } = request.params

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return response.status(401).json({ error: 'A valid x-user-id is required' })
  }

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    return response.status(400).json({ error: 'A valid projectId is required' })
  }

  const user = await User.findById(userId).select('_id').lean()
  if (!user) return response.status(403).json({ error: 'User is not authorized' })

  const project = await Project.findOne({ _id: projectId, userId }).select('_id spaceId userId').lean()
  if (!project) return response.status(404).json({ error: 'Project not found' })

  const space = await Space.findOne({ _id: project.spaceId, userId }).select('_id userId').lean()
  if (!space) return response.status(404).json({ error: 'Project space not found' })

  request.scope = { userId: user._id, spaceId: space._id, projectId: project._id }
  return next()
}
