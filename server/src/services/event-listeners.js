import { User } from '../models/index.js'
import { EVENTS, subscribeEvent } from './event.service.js'

function registerEventListeners() {
  const activityEvents = [
    EVENTS.TUTOR_QUESTION,
    EVENTS.QUIZ_COMPLETED,
    EVENTS.ASSESSMENT_COMPLETED,
    EVENTS.MATERIAL_PROCESSED,
    EVENTS.RECOMMENDATION_GENERATED,
  ]

  for (const event of activityEvents) {
    subscribeEvent(event, async ({ userId }) => {
      if (userId) await User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } }).lean()
    })
  }
}

export { registerEventListeners }