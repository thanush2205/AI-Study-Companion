import { Activity, Assessment, Concept, Mastery } from '../models/index.js'
import { AIService } from './ai-provider-router.js'
import { updateMastery } from './mastery-engine.js'

function parseEvaluation(text) {
  const value = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
  const required = ['score', 'concept', 'correctPoints', 'missingPoints', 'misconceptions', 'feedback', 'masteryImpact']
  if (required.some((field) => value[field] === undefined)) throw new Error('Assessment response is incomplete')
  if (!Number.isFinite(value.score) || value.score < 0 || value.score > 100) throw new Error('Assessment score is invalid')
  if (![value.correctPoints, value.missingPoints, value.misconceptions].every(Array.isArray)) throw new Error('Assessment points are invalid')
  if (typeof value.feedback !== 'string' || !Number.isFinite(value.masteryImpact)) throw new Error('Assessment feedback is invalid')
  return { ...value, masteryImpact: Math.max(-1, Math.min(1, value.masteryImpact)) }
}

function fallbackEvaluation({ concept, answer }) {
  const score = answer.trim().length >= 80 ? 60 : answer.trim().length >= 30 ? 40 : 20
  return {
    score,
    concept: concept.name,
    correctPoints: answer.trim() ? ['Attempt addresses the requested concept.'] : [],
    missingPoints: ['Add a definition, mechanism, and concrete example.'],
    misconceptions: [],
    feedback: 'Build the answer with a clear definition, explanation, and example from the learning material.',
    masteryImpact: (score - 50) / 500,
  }
}

export async function evaluateOpenAssessment({ projectId, userId, conceptId, question, answer }) {
  const concept = await Concept.findOne({ _id: conceptId, projectId }).select('name description').lean()
  if (!concept) throw Object.assign(new Error('Concept not found in this project'), { statusCode: 404 })

  let evaluation
  let provider = 'deterministic-fallback'
  let model
  try {
    const generated = await AIService.generate({
      projectId,
      userId,
      operation: 'open-ended-assessment',
      instructions: 'Return only valid JSON with score (0-100), concept, correctPoints (string array), missingPoints (string array), misconceptions (string array), feedback (string), and masteryImpact (-1 to 1). Evaluate only against the supplied concept context.',
      input: `Question: ${question}\nLearner answer: ${answer}\nConcept: ${concept.name}\nConcept context: ${concept.description || 'No description available.'}`,
    })
    evaluation = parseEvaluation(generated.text)
    provider = generated.provider
    model = generated.model
  } catch {
    evaluation = fallbackEvaluation({ concept, answer })
  }

  const assessment = await Assessment.create({
    projectId,
    userId,
    assessmentType: 'open-ended',
    conceptId,
    question,
    answer,
    score: evaluation.score / 100,
    correctPoints: evaluation.correctPoints,
    missingPoints: evaluation.missingPoints,
    misconceptions: evaluation.misconceptions,
    feedback: evaluation.feedback,
    masteryImpact: evaluation.masteryImpact,
    summary: evaluation.feedback,
  })
  await updateMastery({ projectId, userId, conceptId, performance: evaluation.score / 100, source: 'assessment', referenceId: assessment._id, evidence: [evaluation.feedback] })
  await Activity.create({ projectId, userId, type: 'assessment.completed', entityType: 'Assessment', entityId: assessment._id, metadata: { score: evaluation.score, provider } })
  return { assessment, evaluation: { ...evaluation, provider, model } }
}

export { parseEvaluation }