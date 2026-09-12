import { Activity } from '../models/index.js'

export const EVENTS = Object.freeze({
  SPACE_CREATED: 'SPACE_CREATED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_ACCESSED: 'PROJECT_ACCESSED',
  MATERIAL_UPLOADED: 'MATERIAL_UPLOADED',
  MATERIAL_PROCESSED: 'MATERIAL_PROCESSED',
  TUTOR_QUESTION: 'TUTOR_QUESTION',
  TUTOR_RESPONSE: 'TUTOR_RESPONSE',
  QUIZ_STARTED: 'QUIZ_STARTED',
  QUIZ_ANSWERED: 'QUIZ_ANSWERED',
  QUIZ_COMPLETED: 'QUIZ_COMPLETED',
  ASSESSMENT_COMPLETED: 'ASSESSMENT_COMPLETED',
  MASTERY_UPDATED: 'MASTERY_UPDATED',
  RECOMMENDATION_GENERATED: 'RECOMMENDATION_GENERATED',
})

const listeners = new Map()

export function subscribeEvent(type, handler) {
  if (!listeners.has(type)) listeners.set(type, [])
  listeners.get(type).push(handler)
}

export async function recordEvent({ type, projectId = null, userId = null, metadata = {}, entityType = null, entityId = null }) {
  const activity = await Activity.create({
    projectId,
    userId,
    type,
    entityType,
    entityId,
    metadata,
  })

  for (const handler of listeners.get(type) ?? []) {
    try {
      await handler({ type, projectId, userId, entityType, entityId, activity, ...metadata })
    } catch (error) {
      console.error(`Event listener failed for ${type}:`, error.message)
    }
  }

  return activity
}