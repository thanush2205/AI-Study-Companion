import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { connect, createConcept, createProject, createSpace, createUser } from './helpers.mjs'
import { analyzeStruggle } from '../src/services/struggle.service.js'

const stamp = `${Date.now()}-${process.pid}`
let seq = 0
const runId = () => `${stamp}-${seq++}`
const mongoose = await connect()
after(async () => { await mongoose.disconnect() })

async function seedStruggle() {
  const user = await createUser(mongoose, { email: `s22-struggle-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Struggle Space')
  const project = await createProject(mongoose, user._id, space._id)
  const concept = await createConcept(mongoose, project._id, 'Interfaces', 'Contract a class must fulfil.')

  const quiz = await mongoose.models.Quiz.create({
    projectId: project._id, title: 'OOP check', generationStatus: 'ready',
    conceptIds: [concept._id],
    questions: [
      { prompt: 'Which keyword declares an interface in Java?', type: 'multiple-choice', options: ['interface', 'abstract', 'class', 'extends'], answer: 'interface', conceptId: concept._id },
      { prompt: 'Can an interface have a constructor?', type: 'multiple-choice', options: ['Yes', 'No', 'Only public ones', 'Only static ones'], answer: 'No', conceptId: concept._id },
      { prompt: 'What is an interface in object oriented programming?', type: 'multiple-choice', options: ['A contract of behaviour', 'A class that can hold data', 'A base class', 'A singleton'], answer: 'A contract of behaviour', conceptId: concept._id },
    ],
  })

  for (const wrong of ['abstract', 'Yes', 'A base class']) {
    await mongoose.models.QuizAttempt.create({
      projectId: project._id, userId: user._id, quizId: quiz._id,
      answers: [
        { questionId: quiz.questions[0]._id, answer: 'abstract', correct: false },
        { questionId: quiz.questions[1]._id, answer: wrong, correct: false },
      ],
      score: 0, completedAt: new Date(),
    })
  }

  await mongoose.models.Mastery.create({
    projectId: project._id, userId: user._id, conceptId: concept._id,
    score: 0.38, currentMastery: 0.38, attempts: 4, correct: 1, level: 'developing',
  })

  await mongoose.models.Assessment.create({
    projectId: project._id, userId: user._id, assessmentType: 'open-ended', conceptId: concept._id,
    question: 'Explain how an interface differs from an abstract class.',
    answer: 'An interface is a class type so it can have constructors.',
    score: 0.4, misconceptions: ['Confuses interface with abstract class'],
  })

  return { user, project, concept }
}

test('struggle analysis explains why a weak concept is missed', async () => {
  const { user, project, concept } = await seedStruggle()

  const result = await analyzeStruggle({ projectId: project._id, userId: user._id, conceptId: concept._id })

  assert.equal(result.insufficientData, false)
  assert.equal(String(result.conceptId), String(concept._id))
  assert.equal(result.concept.name, 'Interfaces')
  assert.equal(result.mastery.percent, 38)
  assert.ok(result.mastery.attempts >= 3)
  assert.ok(typeof result.insight.summary === 'string' && result.insight.summary.length > 0, 'summary should explain the struggle')
  assert.ok(typeof result.insight.pattern === 'string' && result.insight.pattern.length > 0)
  assert.ok(Array.isArray(result.insight.reasons) && result.insight.reasons.length >= 1)
  assert.ok(result.evidenceCount >= 3, 'quiz, assessment and tutor signals should count')
  assert.ok(Array.isArray(result.insight.evidence) && result.insight.evidence.length >= 1, 'evidence quotes the learner')
  const evidenceFromQuiz = result.insight.evidence.some((item) => item.source === 'quiz')
  assert.ok(evidenceFromQuiz, 'should cite the learner quiz answers')
  const types = result.insight.recommendations.map((item) => item.type)
  assert.ok(types.includes('review'), 'should recommend reviewing the material')
  assert.ok(types.includes('tutor'), 'should recommend asking the tutor')
  assert.ok(types.includes('quiz'), 'should recommend a targeted quiz')
  assert.ok(['ai', 'heuristic'].includes(result.source), 'should resolve with AI or a deterministic fallback')
})

test('struggle analysis reports insufficient data gracefully', async () => {
  const { user, project, concept } = await seedStruggle()
  const freshConcept = await createConcept(mongoose, project._id, 'Generics', 'Type parameters at compile time.')

  const result = await analyzeStruggle({ projectId: project._id, userId: user._id, conceptId: freshConcept._id })

  assert.equal(result.insufficientData, true)
  assert.equal(result.evidenceCount, 0)
  assert.ok(typeof result.reason === 'string')
  assert.equal(result.insight, undefined)
})