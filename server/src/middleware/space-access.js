import mongoose from 'mongoose'
import { Space } from '../models/index.js'

export async function requireSpaceAccess(request, response, next) {
  const { spaceId } = request.params

  if (!mongoose.isValidObjectId(spaceId)) {
    return response.status(400).json({ error: 'A valid spaceId is required' })
  }

  const space = await Space.findOne({ _id: spaceId, userId: request.user._id }).lean()
  if (!space) return response.status(404).json({ error: 'Space not found' })

  request.space = space
  return next()
}
