import mongoose from 'mongoose'
import { Project, Quiz, Space } from '../models/index.js'

export async function requireQuizAccess(request, response, next) {
  const { quizId } = request.params
  if (!mongoose.isValidObjectId(quizId)) return response.status(400).json({ error: 'A valid quiz id is required' })

  const quiz = await Quiz.findById(quizId).lean()
  if (!quiz) return response.status(404).json({ error: 'Quiz not found' })
  const project = await Project.findOne({ _id: quiz.projectId, userId: request.user._id }).lean()
  if (!project) return response.status(404).json({ error: 'Quiz not found' })
  const space = await Space.findOne({ _id: project.spaceId, userId: request.user._id }).select('_id').lean()
  if (!space) return response.status(404).json({ error: 'Quiz not found' })

  request.quiz = quiz
  request.scope = { userId: request.user._id, spaceId: space._id, projectId: project._id }
  return next()
}
