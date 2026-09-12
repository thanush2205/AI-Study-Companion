import { Assessment, Concept, Mastery, QuizAttempt } from '../models/index.js'
import { AIService } from './ai-provider-router.js'

const strongThreshold = 0.6
const weekMs = 7 * 24 * 60 * 60 * 1000

function weeklyLevels(mastery) {
  return mastery.history
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((entry) => ({ week: Math.floor(new Date(entry.createdAt).getTime() / weekMs), mastery: entry.newMastery, createdAt: new Date(entry.createdAt) }))
}

function buildTimeline(masteries) {
  const trends = masteries.map((m) => ({ conceptId: m.conceptId, points: weeklyLevels(m) }))
  const weeks = [...new Set(trends.flatMap((t) => t.points.map((p) => p.week)))].sort((a, b) => a - b)
  const minWeek = weeks[0] ?? 0

  const growth = weeks.map((week) => {
    let total = 0
    let count = 0
    for (const { points } of trends) {
      const latest = [...points].reverse().find((p) => p.week <= week)
      if (!latest) continue
      total += latest.mastery
      count += 1
    }
    return {
      week: `Week ${week - minWeek + 1}`,
      startDate: new Date(week * weekMs).toISOString().slice(0, 10),
      mastery: count ? Number((total / count).toFixed(4)) : 0,
      masteryPercent: count ? Math.round((total / count) * 100) : 0,
    }
  })

  const conceptTrends = trends.map((t) => ({
    conceptId: t.conceptId,
    points: t.points.map((p) => ({ week: `Week ${p.week - minWeek + 1}`, mastery: p.mastery, masteryPercent: Math.round(p.mastery * 100) })),
  }))

  return { growth, conceptTrends }
}

function fallbackInsight({ strengths, needsAttention, growth }) {
  const strongNames = strengths.map((s) => s.concept)
  const weakNames = needsAttention.map((w) => w.concept)
  const first = growth[0]?.masteryPercent ?? 0
  const last = growth.at(-1)?.masteryPercent ?? 0
  const gain = last - first

  const parts = []
  if (strongNames.length) parts.push(`You are strongest in ${strongNames.join(', ')}.`)
  if (gain > 0) parts.push(`Overall mastery improved ${gain}% over the period.`)
  else if (gain < 0) parts.push(`Overall mastery slipped ${Math.abs(gain)}% over the period.`)
  if (weakNames.length) parts.push(`${weakNames.join(', ')} need attention — review those concepts and practise again.`)
  return parts.join(' ') || 'Keep practising to build mastery across your concepts.'
}

async function generateInsight({ projectId, userId, input, fallback }) {
  try {
    const generated = await AIService.generate({
      projectId,
      userId,
      operation: 'growth-analysis',
      instructions: 'You are an expert learning analyst. Write ONE concise insight of 2-3 sentences about this learner: name their strengths, their biggest improvement, and one specific concept confusion they should work on. Use exact concept names. Do not use markdown or bullet points.',
      input: JSON.stringify(input),
    })
    return { text: generated.text, provider: generated.provider }
  } catch {
    return { text: fallback, provider: 'deterministic-fallback' }
  }
}

export async function getGrowthAnalysis({ projectId, userId }) {
  const [masteries, concepts, assessments, quizAttempts] = await Promise.all([
    Mastery.find({ projectId, userId }).lean(),
    Concept.find({ projectId }).select('name').lean(),
    Assessment.find({ projectId, userId }).sort({ createdAt: -1 }).select('conceptId summary score createdAt').limit(8).lean(),
    QuizAttempt.find({ projectId, userId }).sort({ createdAt: -1 }).select('score completedAt').limit(8).lean(),
  ])

  const conceptNames = new Map(concepts.map((concept) => [concept._id.toString(), concept.name]))
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const rows = masteries
    .map((m) => ({
      conceptId: m.conceptId,
      concept: conceptNames.get(m.conceptId.toString()) ?? 'Unknown concept',
      currentMastery: m.currentMastery,
      masteryPercent: Math.round(m.currentMastery * 100),
      previousMastery: m.previousMastery,
      weeklyDelta: Number((m.history
        .filter((h) => new Date(h.createdAt) >= weekAgo)
        .reduce((sum, h) => sum + (h.newMastery - h.previousMastery), 0) * 100).toFixed(1)),
      attempts: m.attempts,
      correct: m.correct,
      level: m.level,
    }))
    .sort((a, b) => b.masteryPercent - a.masteryPercent)

  const strengths = rows.filter((row) => row.currentMastery >= strongThreshold)
  const needsAttention = rows.filter((row) => row.currentMastery < strongThreshold)

  const { growth, conceptTrends } = buildTimeline(masteries)

  const { text: insight, provider } = await generateInsight({
    projectId,
    userId,
    fallback: fallbackInsight({ strengths, needsAttention, growth }),
    input: {
      strengths: strengths.map((s) => ({ concept: s.concept, mastery: s.masteryPercent, level: s.level })),
      needsAttention: needsAttention.map((w) => ({ concept: w.concept, mastery: w.masteryPercent, level: w.level })),
      weeklyTrend: growth.map((g) => ({ week: g.week, mastery: g.masteryPercent })),
      recentQuizScores: quizAttempts.map((attempt) => ({ score: Math.round(attempt.score * 100), completedAt: attempt.completedAt })),
      recentAssessmentFeedback: assessments.map((a) => ({ concept: conceptNames.get(a.conceptId.toString()) ?? null, feedback: a.summary, score: Math.round(a.score * 100) })),
    },
  })

  return {
    strengths,
    needsAttention,
    growth,
    conceptTrends,
    insight,
    providedBy: provider,
    generatedAt: new Date().toISOString(),
  }
}

export { fallbackInsight, strongThreshold }