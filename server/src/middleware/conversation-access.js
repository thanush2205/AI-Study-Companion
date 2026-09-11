import mongoose from 'mongoose'
import { Conversation, Project, Space } from '../models/index.js'

export async function requireConversationAccess(request, response, next) {
  const { conversationId, id } = request.params
  const targetId = conversationId ?? id
  if (!mongoose.isValidObjectId(targetId)) return response.status(400).json({ error: 'A valid conversation id is required' })

  const conversation = await Conversation.findOne({ _id: targetId, userId: request.user._id }).lean()
  if (!conversation) return response.status(404).json({ error: 'Conversation not found' })

  const project = await Project.findOne({ _id: conversation.projectId, userId: request.user._id }).select('_id spaceId title description learningGoal status').lean()
  if (!project) return response.status(404).json({ error: 'Conversation not found' })

  const space = await Space.findOne({ _id: project.spaceId, userId: request.user._id }).select('_id name').lean()
  if (!space) return response.status(404).json({ error: 'Conversation not found' })

  request.conversation = conversation
  request.project = project
  request.scope = { userId: request.user._id, spaceId: space._id, projectId: project._id }
  return next()
}
