import { randomUUID } from 'node:crypto'
import { AIEvaluation, Chunk, Material, Project, Space } from '../models/index.js'
import { generateEmbedding } from './embedding.service.js'
import { answerQuestion } from './knowledge-engine.js'
import { evaluationCases, evaluationMaterial } from './evaluation.dataset.js'

const seedTitle = 'Evaluation Seed — Object Oriented Programming'

async function ensureEvaluationSeed(userId) {
  const existing = await Project.findOne({ title: seedTitle, userId }).select('_id spaceId').lean()
  if (existing) return existing

  const space = await Space.create({ userId, name: 'AI Evaluation' })
  const project = await Project.create({
    userId: userId,
    spaceId: space._id,
    title: seedTitle,
    description: 'Seeded material used by the AI quality evaluation suite.',
    learningGoal: 'Verify grounded answering, citations, and refusal behavior.',
  })

  const material = await Material.create({
    projectId: project._id,
    uploadedBy: userId,
    title: seedTitle,
    type: 'text',
    processingStatus: 'READY',
  })

  await Promise.all(evaluationMaterial.map((text, chunkIndex) => Chunk.create({
    projectId: project._id,
    materialId: material._id,
    chunkIndex,
    text,
    content: text,
    pageNumber: 1,
    tokenCount: text.split(/\s+/).length,
    embedding: generateEmbedding(text),
  })))

  return { _id: project._id, spaceId: space._id }
}

export async function runEvaluation(userId, runId = randomUUID()) {
  const seed = await ensureEvaluationSeed(userId)

  const cases = []
  for (const scenario of evaluationCases) {
    const started = Date.now()
    try {
      const result = await answerQuestion({ projectId: seed._id, userId, question: scenario.question })
      const grounded = result.responseType === 'grounded-answer'
      const refused = result.responseType === 'refusal'
      const record = await AIEvaluation.create({
        caseId: scenario.id,
        category: scenario.category,
        question: scenario.question,
        expected: scenario.expected,
        actual: result.responseType,
        grounded,
        cited: (result.citations?.length ?? 0) > 0,
        refused,
        correct: scenario.expected === result.responseType,
        evidenceCount: result.evidenceCount ?? 0,
        provider: result.provider ?? null,
        model: result.model ?? null,
        latencyMs: Date.now() - started,
        runId,
      })
      cases.push(record)
    } catch (error) {
      const record = await AIEvaluation.create({
        caseId: scenario.id,
        category: scenario.category,
        question: scenario.question,
        expected: scenario.expected,
        actual: 'refusal',
        grounded: false,
        cited: false,
        refused: false,
        correct: false,
        evidenceCount: 0,
        latencyMs: Date.now() - started,
        error: String(error.message ?? error).slice(0, 500),
        runId,
      })
      cases.push(record)
    }
  }

  const summary = summarize(cases)
  return { runId, cases, summary }
}

function summarize(cases) {
  const supported = cases.filter((c) => c.category === 'supported')
  const unsupported = cases.filter((c) => c.category === 'unsupported')
  return {
    total: cases.length,
    passed: cases.filter((c) => c.correct).length,
    passRate: cases.length ? Math.round((cases.filter((c) => c.correct).length / cases.length) * 100) : 0,
    groundedCount: cases.filter((c) => c.grounded).length,
    citedCount: cases.filter((c) => c.cited).length,
    groundedRate: supported.length ? Math.round((supported.filter((c) => c.grounded).length / supported.length) * 100) : 0,
    refusalRate: unsupported.length ? Math.round((unsupported.filter((c) => c.refused).length / unsupported.length) * 100) : 0,
  }
}

export async function listEvaluationRuns({ limit = 20 } = {}) {
  const numericLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const raw = await AIEvaluation.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$runId', results: { $push: '$$ROOT' } } },
  ])

  const newestFirst = raw.sort((a, b) => new Date(b.results[0]?.createdAt) - new Date(a.results[0]?.createdAt)).slice(0, numericLimit)

  const runs = await Promise.all(newestFirst.map(async (run) => {
    const sorted = [...run.results].sort((a, b) => a.caseId.localeCompare(b.caseId))
    return {
      runId: run._id,
      createdAt: run.results[0]?.createdAt ?? null,
      summary: summarize(sorted),
      cases: sorted.map(({ _id, caseId, category, question, expected, actual, grounded, cited, refused, correct, provider, model, latencyMs, error }) => ({ _id, caseId, category, question, expected, actual, grounded, cited, refused, correct, provider, model, latencyMs, error })),
    }
  }))

  return { runs }
}