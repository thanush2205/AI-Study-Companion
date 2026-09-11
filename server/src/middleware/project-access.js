import mongoose from 'mongoose'
import { Project, Space } from '../models/index.js'

export async function requireProjectAccess(request, response, next) {
  const { projectId } = request.params

  if (!mongoose.isValidObjectId(projectId)) {
    return response.status(400).json({ error: 'A valid projectId is required' })
  }

  const project = await Project.findOne({ _id: projectId, userId: request.user._id })
    .select('_id spaceId userId title description learningGoal status')
    .lean()
  if (!project) return response.status(404).json({ error: 'Project not found' })

  const space = await Space.findOne({ _id: project.spaceId, userId: request.user._id })
    .select('_id userId name')
    .lean()
  if (!space) return response.status(404).json({ error: 'Project space not found' })

  request.scope = { userId: request.user._id, spaceId: space._id, projectId: project._id }
  request.project = project
  return next()
}
