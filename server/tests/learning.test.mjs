import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { connect, createConcept, createProject, createSpace, createUser } from './helpers.mjs'

const stamp = `${Date.now()}-${process.pid}`
let seq = 0
const runId = () => `${stamp}-${seq++}`
const mongoose = await connect()
after(async () => { await mongoose.disconnect() })

async function seedLearner() {
  const user = await createUser(mongoose, { email: `s20-learn-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Learn Space')
  const project = await createProject(mongoose, user._id, space._id)
  const weak = await createConcept(mongoose, project._id, 'Weak Topic', 'Foundational and poorly understood.')
  const strong = await createConcept(mongoose, project._id, 'Strong Topic', 'Well understood and practised.')
  await mongoose.models.Mastery.create({ projectId: project._id, userId: user._id, conceptId: weak._id, score: 0.15, currentMastery: 0.15, attempts: 2, correct: 0, level: 'novice' })
  await mongoose.models.Mastery.create({ projectId: project._id, userId: user._id, conceptId: strong._id, score: 0.92, currentMastery: 0.92, attempts: 4, correct: 4, level: 'mastered' })
  return { user, project, weak, strong }
}

test('quiz is generated adaptively and prioritizes the weakest concept', async () => {
  const { user, project, weak } = await seedLearner()
  const { generateAdaptiveQuiz } = await import('../src/services/quiz-engine.js')

  const quiz = await generateAdaptiveQuiz({ projectId: project._id, userId: user.id, count: 2 })

  assert.ok(Array.isArray(quiz.questions) && quiz.questions.length === 2)
  for (const question of quiz.questions) {
    assert.ok(typeof question.prompt === 'string' && question.prompt.length > 0)
    assert.ok(Array.isArray(question.options) && question.options.length >= 2)
    assert.ok(question.answer)
  }
  assert.equal(quiz.questions[0].conceptId.toString(), weak._id.toString(), 'weakest concept should be asked first')
})

test('quiz is evaluated with a scored attempt and feedback', async () => {
  const { user, project } = await seedLearner()
  const { evaluateQuiz, generateAdaptiveQuiz } = await import('../src/services/quiz-engine.js')

  const quiz = await generateAdaptiveQuiz({ projectId: project._id, userId: user.id, count: 2 })
  const answers = quiz.questions.map((question, index) => ({ questionId: question._id, answer: index === 0 ? question.answer : 'definitely wrong' }))

  const result = await evaluateQuiz({ quiz, projectId: project._id, userId: user.id, answers })

  assert.equal(result.score, 0.5)
  assert.ok(typeof result.feedback === 'string' && result.feedback.length > 0)
  assert.equal(result.answers.length, 2)
  assert.equal(result.answers[0].correct, true)
  assert.equal(result.answers[1].correct, false)
  assert.ok(result.attempt._id)
})

test('mastery is updated after a quiz attempt', async () => {
  const { user, project, weak } = await seedLearner()
  const { evaluateQuiz, generateAdaptiveQuiz } = await import('../src/services/quiz-engine.js')

  const quiz = await generateAdaptiveQuiz({ projectId: project._id, userId: user.id, count: 1 })
  await evaluateQuiz({ quiz, projectId: project._id, userId: user.id, answers: [{ questionId: quiz.questions[0]._id, answer: 'deliberately wrong' }] })

  const mastery = await mongoose.models.Mastery.findOne({ projectId: project._id, userId: user._id, conceptId: weak._id }).lean()
  assert.ok(mastery, 'mastery record must exist after evaluation')
  assert.equal(mastery.attempts, 3, 'attempt count should increment')
  assert.equal(mastery.correct, 0)
  const expected = Number((0.15 * 0.7 + 0 * 0.3).toFixed(4))
  assert.ok(Math.abs(mastery.score - expected) < 1e-4, `score should decay toward performance: ${mastery.score}`)
})

test('weak concept is detected and a recommendation is generated', async () => {
  const { user, project, weak } = await seedLearner()
  const { generateRecommendations } = await import('../src/services/recommendation-engine.js')

  const result = await generateRecommendations({ projectId: project._id, userId: user.id })

  assert.ok(Array.isArray(result.recommendations) && result.recommendations.length >= 1)
  const review = result.recommendations.find((item) => item.type === 'review')
  assert.ok(review, 'expected a review recommendation for the weak concept')
  assert.equal(review.conceptId.toString(), weak._id.toString())
  assert.ok(typeof review.why === 'string' && review.why.length > 0)
  const persisted = await mongoose.models.Recommendation.find({ projectId: project._id, userId: user._id }).lean()
  assert.ok(persisted.length >= 1, 'recommendations should be persisted')
})