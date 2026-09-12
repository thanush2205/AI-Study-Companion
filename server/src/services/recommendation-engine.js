import { Activity, Assessment, Concept, Mastery, Project, Recommendation } from '../models/index.js'
import { EVENTS, recordEvent } from './event.service.js'

const reviewMasteryThreshold = 0.4
const tutorMasteryThreshold = 0.6
const advancedMasteryThreshold = 0.8
const inactiveDaysThreshold = 3
const repeatedMistakeAttempts = 2
const repeatedMistakeAccuracy = 0.5

function buildEvidence({ mastery, recentAssessments }) {
  const recent = recentAssessments.filter((a) => a.score < 0.6)
  if (recent.length >= 2) {
    const names = [...new Set(recent.slice(0, 3).map((a) => a.concept).filter(Boolean))]
    return `Your last ${recent.length} assessments showed difficulty with ${names.length ? names.join(' and ') : mastery.concept}.`
  }
  if (mastery.attempts >= repeatedMistakeAttempts) {
    return `You have answered ${mastery.attempts} attempts with ${mastery.correct} correct (${mastery.accuracy}% accuracy) on ${mastery.concept}.`
  }
  return `Your current mastery for ${mastery.concept} is ${mastery.masteryPercent}%.`
}

function buildWhy({ mastery, type, daysInactive, learningGoal, recentAssessments }) {
  switch (type) {
    case 'review':
      return buildEvidence({ mastery, recentAssessments })
    case 'tutor':
      return buildEvidence({ mastery, recentAssessments })
    case 'quiz':
      return `You have mastered ${mastery.concept} (${mastery.masteryPercent}%). Push yourself with an advanced quiz to apply it.`
    case 'study-plan':
      return `You haven't studied for ${daysInactive} days. Continue your learning goal: ${learningGoal || 'keep building mastery across your concepts'}`
    default:
      return `Keep building mastery of ${mastery.concept}.`
  }
}

export async function generateRecommendations({ projectId, userId }) {
  const [masteries, concepts, assessments, activity] = await Promise.all([
    Mastery.find({ projectId, userId }).lean(),
    Concept.find({ projectId }).select('name').lean(),
    Assessment.find({ projectId, userId }).sort({ createdAt: -1 }).select('conceptId score createdAt').limit(12).lean(),
    Activity.findOne({ projectId, userId }).sort({ createdAt: -1 }).select('createdAt').lean(),
  ])

  const conceptNames = new Map(concepts.map((concept) => [concept._id.toString(), concept.name]))
  const assessmentsByConcept = new Map()
  for (const assessment of assessments) {
    const key = assessment.conceptId.toString()
    const list = assessmentsByConcept.get(key) ?? []
    list.push({ ...assessment, concept: conceptNames.get(key) ?? 'this concept' })
    assessmentsByConcept.set(key, list)
  }

  const daysInactive = activity ? Math.floor((Date.now() - new Date(activity.createdAt).getTime()) / (24 * 60 * 60 * 1000)) : 0
  const learningGoal = await Project.findOne({ _id: projectId }).select('learningGoal').lean().catch(() => null)

  const candidates = []
  for (const m of masteries) {
    const mastery = {
      conceptId: m.conceptId,
      concept: conceptNames.get(m.conceptId.toString()) ?? 'Unknown concept',
      currentMastery: m.currentMastery,
      masteryPercent: Math.round(m.currentMastery * 100),
      attempts: m.attempts,
      correct: m.correct,
      accuracy: m.attempts ? Math.round((m.correct / m.attempts) * 100) : 0,
    }
    const recentAssessments = assessmentsByConcept.get(m.conceptId.toString()) ?? []

    if (mastery.currentMastery < reviewMasteryThreshold) {
      candidates.push({
        type: 'review',
        title: `Review "${mastery.concept}"`,
        action: `Review "${mastery.concept}" for 10 minutes.`,
        conceptId: mastery.conceptId,
        concept: mastery.concept,
        urgency: mastery.currentMastery,
      })
    }

    const repeatedMistakes = mastery.attempts >= repeatedMistakeAttempts && mastery.accuracy < repeatedMistakeAccuracy * 100
    if (mastery.currentMastery < tutorMasteryThreshold && repeatedMistakes) {
      candidates.push({
        type: 'tutor',
        title: `Ask the tutor about "${mastery.concept}"`,
        action: `Ask the AI tutor about ${mastery.concept}.`,
        conceptId: mastery.conceptId,
        concept: mastery.concept,
        urgency: mastery.currentMastery,
      })
    }

    if (mastery.currentMastery > advancedMasteryThreshold) {
      candidates.push({
        type: 'quiz',
        title: `Take an advanced quiz on "${mastery.concept}"`,
        action: `Take an advanced quiz to level up ${mastery.concept}.`,
        conceptId: mastery.conceptId,
        concept: mastery.concept,
        urgency: 1 - mastery.currentMastery,
      })
    }
  }

  const recommendations = {}
  if (daysInactive >= inactiveDaysThreshold) {
    recommendations.inactive = {
      type: 'study-plan',
      title: 'Continue your learning goal',
      action: 'Resume your previous learning goal.',
      conceptId: null,
      concept: null,
      daysInactive,
    }
  }

  const ordered = [
    ...candidates.filter((c) => c.type === 'review').sort((a, b) => a.urgency - b.urgency),
    ...candidates.filter((c) => c.type === 'tutor').sort((a, b) => a.urgency - b.urgency),
    ...candidates.filter((c) => c.type === 'quiz').sort((a, b) => a.urgency - b.urgency),
  ]

  for (const candidate of ordered) {
    const mastery = masteries.find((m) => m.conceptId.toString() === candidate.conceptId?.toString())
    candidate.why = buildWhy({
      mastery: {
        ...candidate,
        masteryPercent: Math.round((mastery?.currentMastery ?? 0) * 100),
        attempts: mastery?.attempts ?? 0,
        correct: mastery?.correct ?? 0,
        accuracy: mastery?.attempts ? Math.round((mastery.correct / mastery.attempts) * 100) : 0,
      },
      type: candidate.type,
      daysInactive,
      learningGoal: learningGoal?.learningGoal,
      recentAssessments: assessmentsByConcept.get(candidate.conceptId?.toString()) ?? [],
    })
  }

  if (recommendations.inactive) recommendations.inactive.why = buildWhy({
    mastery: null,
    type: 'study-plan',
    daysInactive,
    learningGoal: learningGoal?.learningGoal,
    recentAssessments: [],
  })

  const top = recommendations.inactive ?? ordered[0] ?? null

  await Recommendation.updateMany(
    { projectId, userId, status: 'new' },
    { $set: { status: 'dismissed' } },
  )
  const persisted = []
  for (const item of [recommendations.inactive, ...ordered].filter(Boolean)) {
    const doc = await Recommendation.create({
      projectId,
      userId,
      type: item.type,
      title: item.title,
      description: `${item.action} ${item.why}`,
      status: 'new',
      metadata: { conceptId: item.conceptId, action: item.action, why: item.why },
    })
    persisted.push(doc.toObject())
  }

  await recordEvent({
    type: EVENTS.RECOMMENDATION_GENERATED,
    projectId,
    userId,
    metadata: { count: persisted.length, topType: top?.type ?? null, topConcept: top?.concept ?? null },
  })

  return {
    top: top
      ? {
          type: top.type,
          title: top.title,
          action: top.action,
          why: top.why,
          conceptId: top.conceptId,
          concept: top.concept,
          daysInactive: top.daysInactive ?? null,
        }
      : null,
    recommendations: [
      recommendations.inactive,
      ...ordered,
    ].filter(Boolean).map((item) => ({
      type: item.type,
      title: item.title,
      action: item.action,
      why: item.why,
      conceptId: item.conceptId,
      concept: item.concept,
      daysInactive: item.daysInactive ?? null,
    })),
    persisted,
  }
}

export { inactiveDaysThreshold, reviewMasteryThreshold, tutorMasteryThreshold, advancedMasteryThreshold }