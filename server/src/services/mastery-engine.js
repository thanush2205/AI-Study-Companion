import { Concept, Mastery } from '../models/index.js'

const levelForMastery = (score) => score < 0.4 ? 'novice' : score < 0.6 ? 'developing' : score < 0.8 ? 'proficient' : 'mastered'
const progressBar = (score) => `${'█'.repeat(Math.round(score * 10))}${'░'.repeat(10 - Math.round(score * 10))}`

export async function updateMastery({ projectId, userId, conceptId, performance, source, referenceId, evidence = [] }) {
  const boundedPerformance = Math.max(0, Math.min(1, performance))
  const existing = await Mastery.findOne({ projectId, userId, conceptId }).lean()
  const oldMastery = existing?.currentMastery ?? existing?.score ?? 0
  const newMastery = Number((oldMastery * 0.7 + boundedPerformance * 0.3).toFixed(4))
  const historyEntry = { previousMastery: oldMastery, performance: boundedPerformance, newMastery, source, referenceId, createdAt: new Date() }

  return Mastery.findOneAndUpdate(
    { projectId, userId, conceptId },
    {
      $set: { score: newMastery, currentMastery: newMastery, previousMastery: oldMastery, level: levelForMastery(newMastery), updatedBy: source === 'quiz' ? 'assessment' : source, evidence },
      $inc: { attempts: 1, correct: boundedPerformance >= 0.5 ? 1 : 0 },
      $push: { history: historyEntry },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

export async function getMasterySnapshot({ projectId, userId }) {
  const masteries = await Mastery.find({ projectId, userId }).sort({ currentMastery: -1 }).lean()
  const concepts = await Concept.find({ _id: { $in: masteries.map((m) => m.conceptId) } }).select('name').lean()
  const conceptNames = new Map(concepts.map((c) => [c._id.toString(), c.name]))
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  return masteries.map((m) => {
    const weeklyDelta = m.history
      .filter((h) => new Date(h.createdAt) >= weekAgo)
      .reduce((sum, h) => sum + (h.newMastery - h.previousMastery), 0)
    return {
      conceptId: m.conceptId,
      concept: conceptNames.get(m.conceptId.toString()) ?? 'Unknown concept',
      currentMastery: m.currentMastery,
      previousMastery: m.previousMastery,
      masteryPercent: Math.round(m.currentMastery * 100),
      bar: progressBar(m.currentMastery),
      weeklyDelta: Number((weeklyDelta * 100).toFixed(1)),
      attempts: m.attempts,
      correct: m.correct,
      accuracy: m.attempts ? Math.round((m.correct / m.attempts) * 100) : 0,
      level: m.level,
      history: m.history.slice(-10).reverse(),
    }
  })
}

export { levelForMastery, progressBar }