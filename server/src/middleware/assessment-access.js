import mongoose from 'mongoose'
import { Assessment, Project, Space } from '../models/index.js'

export async function requireAssessmentAccess(request, response, next) {
  const { id } = request.params
  if (!mongoose.isValidObjectId(id)) return response.status(400).json({ error: 'A valid assessment id is required' })
  const assessment = await Assessment.findOne({ _id: id, userId: request.user._id }).lean()
  if (!assessment) return response.status(404).json({ error: 'Assessment not found' })
  const project = await Project.findOne({ _id: assessment.projectId, userId: request.user._id }).select('_id spaceId').lean()
  if (!project) return response.status(404).json({ error: 'Assessment not found' })
  const space = await Space.findOne({ _id: project.spaceId, userId: request.user._id }).select('_id').lean()
  if (!space) return response.status(404).json({ error: 'Assessment not found' })
  request.assessment = assessment
  return next()
}