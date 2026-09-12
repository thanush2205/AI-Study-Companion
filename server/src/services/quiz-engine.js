import { Concept, Mastery, Quiz, QuizAttempt } from '../models/index.js'
import { AIService } from './ai-provider-router.js'
import { updateMastery } from './mastery-engine.js'
import { EVENTS, recordEvent } from './event.service.js'

const difficultyForScore = (score) => score < 0.4 ? 'easy' : score <= 0.7 ? 'medium' : 'hard'
const levelForScore = (score) => score < 0.4 ? 'novice' : score < 0.6 ? 'developing' : score < 0.8 ? 'proficient' : 'mastered'

function parseStructuredQuestion(text) {
  const normalized = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(normalized)
  const required = ['question', 'options', 'correctAnswer', 'concept', 'difficulty', 'explanation']
  if (required.some((field) => parsed[field] === undefined)) throw new Error('Structured quiz response is incomplete')
  if (!Array.isArray(parsed.options) || parsed.options.length < 2) throw new Error('Structured quiz options are invalid')
  if (!parsed.options.includes(parsed.correctAnswer)) throw new Error('Structured quiz answer is invalid')
  if (!['easy', 'medium', 'hard'].includes(parsed.difficulty)) throw new Error('Structured quiz difficulty is invalid')
  return parsed
}

function fallbackQuestion(concept, difficulty) {
  const answer = concept.name
  return {
    question: `Which concept is the focus of this question: ${concept.description || concept.name}?`,
    options: [answer, 'An unrelated implementation detail', 'A database connection setting', 'A user interface color'],
    correctAnswer: answer,
    concept: concept.name,
    difficulty,
    explanation: `${concept.name} is the concept selected for this ${difficulty} practice question.`,
  }
}

async function createQuestion({ concept, difficulty, projectId, userId }) {
  try {
    const generated = await AIService.generate({
      projectId,
      userId,
      operation: 'quiz-question',
      instructions: 'Return only valid JSON with exactly these fields: question (string), options (array of strings), correctAnswer (string), concept (string), difficulty (easy|medium|hard), explanation (string). Do not use markdown fences.',
      input: `Create one ${difficulty} multiple-choice question about the concept "${concept.name}". Context: ${concept.description || 'No additional description.'}`,
    })
    return parseStructuredQuestion(generated.text)
  } catch {
    return fallbackQuestion(concept, difficulty)
  }
}

export async function generateAdaptiveQuiz({ projectId, userId, count = 5 }) {
  const [concepts, mastery] = await Promise.all([
    Concept.find({ projectId }).select('_id name description').lean(),
    Mastery.find({ projectId, userId }).select('conceptId score').lean(),
  ])
  const masteryByConcept = new Map(mastery.map((item) => [item.conceptId.toString(), item.score]))
  const ranked = concepts
    .map((concept) => ({ concept, score: masteryByConcept.get(concept._id.toString()) ?? 0 }))
    .sort((left, right) => left.score - right.score)
    .slice(0, Math.max(1, Math.min(Number(count) || 5, 10)))

  const questions = await Promise.all(ranked.map(({ concept, score }) => createQuestion({ concept, difficulty: difficultyForScore(score), projectId, userId })))
  const quiz = await Quiz.create({
    projectId,
    conceptIds: ranked.map(({ concept }) => concept._id),
    title: 'Adaptive mastery check',
    questions: questions.map((question, index) => ({
      prompt: question.question,
      type: 'multiple-choice',
      options: question.options,
      answer: question.correctAnswer,
      explanation: question.explanation,
      conceptId: ranked[index].concept._id,
    })),
    generationStatus: 'ready',
  })
  await recordEvent({
    type: EVENTS.QUIZ_STARTED,
    projectId,
    userId,
    entityType: 'Quiz',
    entityId: quiz._id,
    metadata: { count: quiz.questions.length },
  })
  return quiz.toObject()
}

export function publicQuiz(quiz) {
  return {
    ...quiz,
    questions: quiz.questions.map(({ answer, ...question }) => question),
  }
}

export async function evaluateQuiz({ quiz, projectId, userId, answers }) {
  const submitted = new Map((answers ?? []).map((answer) => [answer.questionId?.toString(), String(answer.answer ?? '').trim()]))
  const evaluated = quiz.questions.map((question) => ({
    questionId: question._id,
    answer: submitted.get(question._id.toString()) ?? '',
    correct: submitted.get(question._id.toString()) === question.answer,
    conceptId: question.conceptId,
    explanation: question.explanation,
  }))
  const score = evaluated.length ? evaluated.filter((answer) => answer.correct).length / evaluated.length : 0
  await recordEvent({
    type: EVENTS.QUIZ_ANSWERED,
    projectId,
    userId,
    entityType: 'Quiz',
    entityId: quiz._id,
    metadata: { answers: evaluated.length, correct: evaluated.filter((a) => a.correct).length },
  })
  const attempt = await QuizAttempt.create({
    projectId,
    quizId: quiz._id,
    userId,
    answers: evaluated.map(({ questionId, answer, correct }) => ({ questionId, answer, correct })),
    score,
    completedAt: new Date(),
  })
  await recordEvent({
    type: EVENTS.QUIZ_COMPLETED,
    projectId,
    userId,
    entityType: 'Quiz',
    entityId: quiz._id,
    metadata: { score, attemptId: attempt._id },
  })

  const conceptResults = new Map()
  for (const answer of evaluated) {
    const current = conceptResults.get(answer.conceptId.toString()) ?? []
    current.push(answer.correct)
    conceptResults.set(answer.conceptId.toString(), current)
  }
  for (const [conceptId, results] of conceptResults) {
    const performance = results.filter(Boolean).length / results.length
    await updateMastery({ projectId, userId, conceptId, performance, source: 'quiz', referenceId: attempt._id, evidence: [`Quiz ${quiz._id} score: ${score}`] })
  }

  return {
    attempt,
    score,
    feedback: score >= 0.8 ? 'Strong work. Move toward application-level questions.' : score >= 0.5 ? 'Good progress. Review the missed concepts and try again.' : 'Start with the foundational material for the concepts you missed.',
    answers: evaluated,
  }
}

export { difficultyForScore, levelForScore, parseStructuredQuestion }
