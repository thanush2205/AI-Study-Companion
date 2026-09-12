import mongoose from 'mongoose'
import Redis from 'ioredis'
import env from '../config/env.js'
import {
  Activity, AIUsage, Concept, Conversation, Mastery,
  Project, QuizAttempt, Space, User,
} from '../models/index.js'
import { percent } from './analytics.service.js'

async function checkRedis() {
  if (!env.redisUrl) return 'not-configured'
  const client = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
  try {
    await client.connect()
    const pong = await client.ping()
    return pong === 'PONG' ? 'ready' : 'degraded'
  } catch {
    return 'down'
  } finally {
    client.disconnect()
  }
}

export async function getSystemHealth() {
  const [database, redis] = await Promise.all([
    Promise.resolve(mongoose.connection.readyState === 1 ? 'ready' : 'down'),
    checkRedis(),
  ])
  const aiConfigured = Boolean(env.groqApiKey || env.geminiApiKey)
  return {
    api: 'ready',
    database,
    redis,
    ai: aiConfigured ? 'ready' : 'not-configured',
    worker: redis === 'ready' ? 'ready' : 'down',
  }
}

export async function getAIUsageSummary() {
  const [summary, operations, recent] = await Promise.all([
    AIUsage.aggregate([
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          successful: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$success', true] }, false] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$success', true] }, false] }, 1, 0] } },
          latencyMs: { $sum: '$latencyMs' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          cost: { $sum: '$cost' },
        },
      },
    ]),
    AIUsage.aggregate([
      { $group: { _id: '$operation', calls: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$success', true] }, false] }, 1, 0] } } } },
      { $sort: { calls: -1 } },
    ]),
    AIUsage.find().sort({ createdAt: -1 }).limit(30).lean(),
  ])
  const requests = summary[0]?.requests ?? 0
  const latencyMs = summary[0]?.latencyMs ?? 0
  return {
    requests,
    successful: summary[0]?.successful ?? 0,
    failed: summary[0]?.failed ?? 0,
    averageLatencySec: requests ? Number((latencyMs / requests / 1000).toFixed(2)) : 0,
    estimatedCost: Number((summary[0]?.cost ?? 0).toFixed(6)),
    inputTokens: summary[0]?.inputTokens ?? 0,
    outputTokens: summary[0]?.outputTokens ?? 0,
    byOperation: operations,
    recent: recent.map(({ _id, provider, model, operation, latencyMs: ms, success, error, createdAt }) => ({ _id, provider, model, operation, latencyMs: ms, success, error, createdAt })),
  }
}

export async function listUsers({ page = 1, limit = 25, search = '' } = {}) {
  const numericPage = Math.max(1, Number(page) || 1)
  const numericLimit = Math.max(1, Math.min(100, Number(limit) || 25))
  const filter = search?.trim() ? { $or: [{ name: new RegExp(search.trim(), 'i') }, { email: new RegExp(search.trim(), 'i') }] } : {}

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('_id name email role avatarUrl lastActiveAt createdAt')
      .sort({ lastActiveAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .lean(),
    User.countDocuments(filter),
  ])

  const userIds = users.map((user) => user._id)
  const [activity, projects, spaces, quizAttempts, conversations] = await Promise.all([
    Activity.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', events: { $sum: 1 } } }]),
    Project.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', projects: { $sum: 1 } } }]),
    Space.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', spaces: { $sum: 1 } } }]),
    QuizAttempt.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', attempts: { $sum: 1 } } }]),
    Conversation.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', conversations: { $sum: 1 } } }]),
  ])

  const counts = (rows) => new Map(rows.map((row) => [row._id.toString(), row]))

  return {
    users: users.map((user) => {
      const key = user._id.toString()
      const activityCount = counts(activity).get(key)
      return {
        ...user,
        activity: activityCount?.events ?? 0,
        projects: counts(projects).get(key)?.projects ?? 0,
        spaces: counts(spaces).get(key)?.spaces ?? 0,
        quizAttempts: counts(quizAttempts).get(key)?.attempts ?? 0,
        conversations: counts(conversations).get(key)?.conversations ?? 0,
      }
    }),
    pagination: { page: numericPage, limit: numericLimit, total },
  }
}

export async function getUserDetail(userId) {
  if (!mongoose.isValidObjectId(userId)) throw Object.assign(new Error('A valid userId is required'), { statusCode: 400 })
  const user = await User.findById(userId).select('_id name email role avatarUrl lastActiveAt createdAt').lean()
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  const [spaces, projects, activity, mastery, quizAttempts, aiUsage] = await Promise.all([
    Space.find({ userId, archivedAt: null }).sort({ createdAt: -1 }).lean(),
    Project.find({ userId }).sort({ createdAt: -1 }).lean(),
    Activity.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Mastery.find({ userId }).select('conceptId currentMastery level attempts correct').lean(),
    QuizAttempt.find({ userId }).select('answers score completedAt').limit(200).lean(),
    AIUsage.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          successful: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$success', true] }, false] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$success', true] }, false] }, 1, 0] } },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          latencyMs: { $sum: '$latencyMs' },
          cost: { $sum: '$cost' },
        },
      },
    ]),
  ])

  const concepts = await Concept.find({ _id: { $in: mastery.map((item) => item.conceptId) } }).select('name').lean()

  const conceptById = new Map(concepts.map((concept) => [concept._id.toString(), concept.name]))

  const answers = quizAttempts.flatMap((attempt) => attempt.answers ?? [])
  const answerTotal = answers.length
  const answerCorrect = answers.filter((answer) => answer.correct).length

  const ai = aiUsage[0] ?? {}
  const requests = ai.requests ?? 0

  return {
    user,
    spaces: spaces.map((space) => ({ ...space, projectCount: projects.filter((p) => p.spaceId?.toString() === space._id.toString()).length })),
    projects: projects.map((project) => ({ _id: project._id, title: project.title, status: project.status, createdAt: project.createdAt, learningGoal: project.learningGoal })),
    activity: { total: activity.length, byType: Object.entries(activity.reduce((acc, row) => ((acc[row.type] = (acc[row.type] ?? 0) + 1), acc), {})).map(([type, count]) => ({ type, count })), recent: activity },
    learningAnalytics: {
      averageMastery: mastery.length ? percent(mastery.reduce((sum, row) => sum + row.currentMastery, 0) / mastery.length) : 0,
      masteryRecords: mastery.map((row) => ({ concept: conceptById.get(row.conceptId.toString()) ?? 'Unknown', mastery: percent(row.currentMastery), level: row.level, attempts: row.attempts, correct: row.correct })).sort((a, b) => b.mastery - a.mastery),
      quizAccuracy: answerTotal ? Math.round((answerCorrect / answerTotal) * 100) : 0,
      quizAttempts: quizAttempts.length,
      assessmentCount: activity.filter((row) => row.type === 'ASSESSMENT_COMPLETED').length,
      tutorRequests: activity.filter((row) => row.type === 'TUTOR_QUESTION').length,
    },
    aiUsage: {
      requests,
      successful: ai.successful ?? 0,
      failed: ai.failed ?? 0,
      averageLatencySec: requests ? Number(((ai.latencyMs ?? 0) / requests / 1000).toFixed(2)) : 0,
      inputTokens: ai.inputTokens ?? 0,
      outputTokens: ai.outputTokens ?? 0,
      estimatedCost: Number((ai.cost ?? 0).toFixed(6)),
    },
  }
}