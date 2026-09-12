import {
  Activity, AIUsage, Assessment, Concept, Conversation, Mastery, Material,
  Message, Project, Quiz, QuizAttempt, Recommendation, Space, User,
} from '../models/index.js'

const percent = (value) => Math.round((value ?? 0) * 100)
const attentionThreshold = 0.6
const masteredThreshold = 0.8

function toMapById(documents) {
  return new Map(documents.map((document) => [document._id.toString(), document]))
}

async function quizAccuracy(match) {
  const [totals, meta] = await Promise.all([
    QuizAttempt.aggregate([
      { $match: match },
      { $unwind: '$answers' },
      { $group: { _id: null, totalAnswers: { $sum: 1 }, correctAnswers: { $sum: { $cond: ['$answers.correct', 1, 0] } } } },
    ]),
    QuizAttempt.aggregate([
      { $match: match },
      { $group: { _id: null, attempts: { $sum: 1 }, avgScore: { $avg: '$score' } } },
    ]),
  ])
  const totalAnswers = totals[0]?.totalAnswers ?? 0
  const correctAnswers = totals[0]?.correctAnswers ?? 0
  return {
    attempts: meta[0]?.attempts ?? 0,
    averageScore: percent(meta[0]?.avgScore),
    answers: totalAnswers,
    correctAnswers,
    accuracy: totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
  }
}

async function messageStats(match) {
  const { userId: _userId, ...scoped } = match
  const rows = await Message.aggregate([
    { $match: scoped },
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ])
  const byRole = Object.fromEntries(rows.map((row) => [row._id, row.count]))
  const tutorQuestions = byRole.user ?? 0
  const assistantAnswers = byRole.assistant ?? 0
  return { tutorQuestions, assistantAnswers, totalMessages: tutorQuestions + assistantAnswers + (byRole.system ?? 0) }
}

async function aiUsageStats(match) {
  const [totals, byOperation, byProvider] = await Promise.all([
    AIUsage.aggregate([
      { $match: match },
      { $group: { _id: null, calls: { $sum: 1 }, inputTokens: { $sum: '$inputTokens' }, outputTokens: { $sum: '$outputTokens' }, cost: { $sum: '$cost' } } },
    ]),
    AIUsage.aggregate([
      { $match: match },
      { $group: { _id: '$operation', calls: { $sum: 1 } } },
      { $sort: { calls: -1 } },
    ]),
    AIUsage.aggregate([
      { $match: match },
      { $group: { _id: '$provider', calls: { $sum: 1 } } },
      { $sort: { calls: -1 } },
    ]),
  ])
  return {
    calls: totals[0]?.calls ?? 0,
    inputTokens: totals[0]?.inputTokens ?? 0,
    outputTokens: totals[0]?.outputTokens ?? 0,
    totalTokens: (totals[0]?.inputTokens ?? 0) + (totals[0]?.outputTokens ?? 0),
    cost: Number((totals[0]?.cost ?? 0).toFixed(6)),
    byOperation: byOperation.map((row) => ({ operation: row._id, calls: row.calls })),
    byProvider: byProvider.map((row) => ({ provider: row._id, calls: row.calls })),
  }
}

async function masteryStats(match) {
  const [totals, levels] = await Promise.all([
    Mastery.aggregate([
      { $match: match },
      { $group: { _id: null, concepts: { $sum: 1 }, avgMastery: { $avg: '$currentMastery' } } },
    ]),
    Mastery.aggregate([
      { $match: match },
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]),
  ])
  return {
    trackedConcepts: totals[0]?.concepts ?? 0,
    averageMastery: percent(totals[0]?.avgMastery),
    levelDistribution: Object.fromEntries(levels.map((row) => [row._id, row.count])),
  }
}

export async function getProjectAnalytics({ projectId, userId }) {
  const scoped = { projectId, userId }
  const [sessions, messages, quiz, mastery, masteryRows, concepts, activityByType, recentActivity, aiUsage] = await Promise.all([
    Conversation.countDocuments(scoped),
    messageStats(scoped),
    quizAccuracy(scoped),
    masteryStats(scoped),
    Mastery.find(scoped).select('conceptId currentMastery level').lean(),
    Concept.find({ projectId }).select('name').lean(),
    Activity.aggregate([
      { $match: scoped },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Activity.find(scoped).sort({ createdAt: -1 }).limit(20).lean(),
    aiUsageStats(scoped),
  ])

  const conceptById = toMapById(concepts)
  const withNames = masteryRows
    .map((row) => ({
      conceptId: row.conceptId,
      concept: conceptById.get(row.conceptId.toString())?.name ?? 'Unknown concept',
      mastery: row.currentMastery,
      masteryPercent: percent(row.currentMastery),
      level: row.level,
    }))
    .sort((left, right) => right.mastery - left.mastery)

  return {
    generatedAt: new Date().toISOString(),
    sessions: {
      total: sessions,
      tutorQuestions: messages.tutorQuestions,
      tutorAnswers: messages.assistantAnswers,
      totalMessages: messages.totalMessages,
      averageMessagesPerSession: sessions ? Number((messages.totalMessages / sessions).toFixed(1)) : 0,
    },
    tutor: {
      questions: messages.tutorQuestions,
      answers: messages.assistantAnswers,
    },
    quiz,
    mastery: {
      ...mastery,
      masteredConcepts: withNames.filter((row) => row.mastery >= masteredThreshold),
      conceptsNeedingAttention: withNames.filter((row) => row.mastery < attentionThreshold),
    },
    activity: {
      total: activityByType.reduce((sum, row) => sum + row.count, 0),
      byType: activityByType.map((row) => ({ type: row._id, count: row.count })),
      recent: recentActivity,
    },
    aiUsage,
  }
}

export async function getGlobalAnalytics() {
  const [
    users, spaces, projects, materials, concepts, conversations, messages,
    assessments, quizzes, quizAttempts, masteryRecords, recommendations,
    quiz, mastery, assessmentAverage, activityByType, recentActivity, aiUsage,
    topWeakConcepts,
  ] = await Promise.all([
    User.countDocuments(),
    Space.countDocuments({ archivedAt: null }),
    Project.countDocuments(),
    Material.countDocuments(),
    Concept.countDocuments(),
    Conversation.countDocuments(),
    Message.countDocuments(),
    Assessment.countDocuments(),
    Quiz.countDocuments(),
    QuizAttempt.countDocuments(),
    Mastery.countDocuments(),
    Recommendation.countDocuments(),
    quizAccuracy({}),
    masteryStats({}),
    Assessment.aggregate([{ $group: { _id: null, avgScore: { $avg: '$score' } } }]),
    Activity.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Activity.find().sort({ createdAt: -1 }).limit(20).lean(),
    aiUsageStats({}),
    Mastery.aggregate([
      { $match: { currentMastery: { $lt: attentionThreshold } } },
      { $group: { _id: '$conceptId', learners: { $sum: 1 }, avgMastery: { $avg: '$currentMastery' } } },
      { $sort: { learners: -1 } },
      { $limit: 10 },
    ]),
  ])

  const weakConceptIds = topWeakConcepts.map((row) => row._id)
  const weakConcepts = await Concept.find({ _id: { $in: weakConceptIds } }).select('name').lean()
  const weakConceptById = toMapById(weakConcepts)

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      users,
      spaces,
      projects,
      materials,
      concepts,
      conversations,
      messages,
      assessments,
      quizzes,
      quizAttempts,
      masteryRecords,
      recommendations,
    },
    quiz,
    assessments: {
      total: assessments,
      averageScore: percent(assessmentAverage[0]?.avgScore),
    },
    mastery,
    activity: {
      total: activityByType.reduce((sum, row) => sum + row.count, 0),
      byType: activityByType.map((row) => ({ type: row._id, count: row.count })),
      recent: recentActivity,
    },
    aiUsage,
    conceptsNeedingAttention: topWeakConcepts.map((row) => ({
      conceptId: row._id,
      concept: weakConceptById.get(row._id.toString())?.name ?? 'Unknown concept',
      learners: row.learners,
      averageMastery: percent(row.avgMastery),
    })),
  }
}

export { attentionThreshold, masteredThreshold, percent }