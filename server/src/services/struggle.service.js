import {
  Assessment, Concept, Conversation, Mastery, Message, Quiz, QuizAttempt,
} from '../models/index.js'
import { AIService } from './ai-provider-router.js'
import { retrieveEvidence } from './knowledge-engine.js'

const percent = (value) => Math.round((value ?? 0) * 100)

function parseJsonText(text) {
  const cleaned = (text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export async function getStruggleEvidence({ projectId, userId, conceptId }) {
  const [concept, mastery, quizAttempts, assessments, conversations] = await Promise.all([
    Concept.findById(conceptId).lean(),
    Mastery.findOne({ projectId, userId, conceptId }).lean(),
    QuizAttempt.find({ projectId, userId }).sort({ createdAt: -1 }).limit(20).lean(),
    Assessment.find({ projectId, userId, conceptId }).sort({ createdAt: -1 }).limit(10).lean(),
    Conversation.find({ projectId, userId }).select('_id').lean(),
  ])

  const quizIds = [...new Set(quizAttempts.map((attempt) => attempt.quizId))]
  const quizzes = quizIds.length
    ? await Quiz.find({ _id: { $in: quizIds } }).select('questions title').lean()
    : []
  const questionsByQuiz = new Map(quizzes.map((quiz) => [quiz._id.toString(), quiz.questions ?? []]))

  const answers = []
  for (const attempt of quizAttempts) {
    const byId = new Map((questionsByQuiz.get(String(attempt.quizId)) ?? []).map((question) => [String(question._id), question]))
    for (const answer of attempt.answers ?? []) {
      const question = byId.get(String(answer.questionId))
      if (question?.conceptId && String(question.conceptId) === String(conceptId)) {
        answers.push({
          prompt: question.prompt,
          given: answer.answer,
          correctAnswer: question.answer,
          wasCorrect: Boolean(answer.correct),
          at: attempt.createdAt ?? attempt.updatedAt,
        })
      }
    }
  }
  answers.sort((left, right) => new Date(right.at) - new Date(left.at))

  const conversationIds = conversations.map((item) => item._id)
  const tutorMessages = conversationIds.length
    ? await Message.find({ projectId, conversationId: { $in: conversationIds }, role: 'user' })
        .sort({ createdAt: -1 }).limit(8).select('content createdAt').lean()
    : []

  return {
    concept,
    mastery,
    quizAnswers: answers,
    assessments,
    tutorQuestions: tutorMessages.map((message) => ({ question: message.content, at: message.createdAt })),
  }
}

export async function groundedPage({ projectId, conceptName }) {
  if (!conceptName) return null
  const { evidence } = await retrieveEvidence({ projectId, question: conceptName })
  const chunk = evidence[0]
  if (!chunk) return null
  return { material: chunk.materialTitle, page: chunk.pageNumber ?? null }
}

function recommendationSet({ concept, answers, confusedWith, grounded }) {
  const recommendation = (type, action, extra = {}) => ({ type, action, ...extra })
  const review = grounded?.page
    ? recommendation('review', `Review Page ${grounded.page} of ${grounded.material} — ${concept.name} in concrete terms.`, { page: grounded.page, material: grounded.material })
    : recommendation('review', `Re-read the material covering ${concept.name} before trying again.`)
  const tutorQuestion = confusedWith
    ? `How is ${concept.name} different from ${confusedWith}?`
    : `Explain ${concept.name} and how it differs from similar concepts.`
  const tutor = recommendation('tutor', `Ask the tutor: "${tutorQuestion}"`, { prompt: tutorQuestion })
  const quiz = recommendation('quiz', 'Take a 3-question quiz focused on this concept.', { count: 3 })
  const answersToReview = answers.filter((answer) => !answer.wasCorrect)
  if (answersToReview.length) {
    const lastPrompt = answersToReview[0].prompt
    const habit = recommendation('quiz', `Retry the question you last missed: "${lastPrompt}"`, { prompt: lastPrompt })
    return [review, tutor, habit, quiz]
  }
  return [review, tutor, quiz]
}

function heuristicInsight({ concept, answers, assessments, tutorQuestions, grounded }) {
  const name = concept?.name ?? 'This concept'
  const wrongAnswers = answers.filter((answer) => !answer.wasCorrect)
  const lastWrong = wrongAnswers.slice(0, 3)
  let pattern = `${name} has not stuck yet — your recent attempts on it were incorrect.`
  let reasons = ['Incorrect quiz answers suggest the idea is not fully connected yet.']
  if (lastWrong.length >= 2) {
    const prompts = lastWrong.map((answer) => `"${answer.prompt}"`).join(', ')
    pattern = `Your last ${lastWrong.length} quiz answers on ${name} were all incorrect (${prompts}).`
    reasons = [`You answered ${prompts} incorrectly.`, 'The same type of question keeps catching you out.']
  }
  if (answers.some((answer) => !answer.wasCorrect) && answers.some((answer) => answer.wasCorrect)) {
    reasons.unshift('You grasp parts of it, but application across question shapes is inconsistent.')
  }
  const summary = `You understand part of ${name}, but you're making the same kind of mistake repeatedly.`
  const confusedWith = null
  return {
    insight: {
      summary,
      pattern,
      reasons: reasons.slice(0, 2),
      evidence: lastWrong.map((answer) => ({
        source: 'quiz',
        detail: `${answer.prompt} — you answered "${answer.given}"${answer.correctAnswer ? ` (correct: "${answer.correctAnswer}")` : ''}`,
        at: answer.at,
        correct: false,
      })),
      recommendations: recommendationSet({ concept, answers, confusedWith, grounded }),
      grounded: Boolean(grounded),
    },
    evidenceCount: answers.length + assessments.length + tutorQuestions.length,
    source: 'heuristic',
  }
}

export async function analyzeStruggle({ projectId, userId, conceptId, maxEvidence = 3 }) {
  const { concept, mastery, quizAnswers, assessments, tutorQuestions } = await getStruggleEvidence({ projectId, userId, conceptId })
  const grounded = await groundedPage({ projectId, conceptName: concept?.name })

  const totalSignals = quizAnswers.length + assessments.length + tutorQuestions.length
  if (!concept || totalSignals === 0) {
    return {
      conceptId,
      concept: concept ? { name: concept.name } : null,
      mastery: mastery ? { percent: percent(mastery.currentMastery), attempts: mastery.attempts, level: mastery.level } : null,
      insufficientData: true,
      reason: 'Keep practising this concept — once you answer a few quiz questions or ask the tutor about it, the insight will appear here.',
      evidenceCount: 0,
    }
  }

  const masteryOut = mastery ? { percent: percent(mastery.currentMastery), attempts: mastery.attempts, correct: mastery.correct, level: mastery.level } : null
  const wrongAnswers = quizAnswers.filter((answer) => !answer.wasCorrect)
  const quizEvidence = wrongAnswers.map((answer) => ({
    source: 'quiz',
    detail: `${answer.prompt} — you answered "${answer.given}"${answer.correctAnswer ? ` (correct: "${answer.correctAnswer}")` : ''}`,
    at: answer.at,
    correct: false,
  }))
  const assessmentEvidence = assessments
    .filter((assessment) => (assessment.misconceptions?.length ?? 0) > 0 || assessment.score !== undefined)
    .map((assessment) => ({ source: 'assessment', detail: assessment.question, at: assessment.createdAt, correct: null }))
  const tutorEvidence = tutorQuestions.map((message) => ({ source: 'tutor', detail: message.question, at: message.at, correct: null }))
  const evidenceOut = [...quizEvidence, ...assessmentEvidence, ...tutorEvidence].slice(0, maxEvidence)
    .map((item) => ({ source: item.source, detail: item.detail, at: item.at, correct: item.correct }))

  let diagnosis = null
  try {
    const input = {
      concept: { name: concept.name, description: concept.description ?? '' },
      mastery: masteryOut,
      questionMistakes: wrongAnswers.slice(0, 6).map((answer) => ({ prompt: answer.prompt, answerGiven: answer.given, correctAnswer: answer.correctAnswer })),
      assessments: assessments.slice(0, 4).map((assessment) => ({ question: assessment.question, misconceptions: assessment.misconceptions ?? [], gaps: assessment.gaps ?? [], strengths: assessment.strengths ?? [] })),
      tutorQuestions: tutorQuestions.slice(0, 6).map((message) => message.question),
    }
    const generated = await AIService.generate({
      projectId,
      userId,
      operation: 'struggle-analysis',
      instructions: [
        'You are a learning-diagnosis coach. Given a learner struggling with one concept, analyze their recent quiz answers, assessments, and tutor questions.',
        'Return ONLY a JSON object with exactly these keys:',
        'summary: a 1-2 sentence plain-language diagnosis of why they are struggling.',
        'pattern: a short label for the repeating misconception, e.g. "Confusing interface with abstract class".',
        'reasons: an array of 1-3 concise reasons grounded ONLY in the supplied data.',
        'confusedWith: the concept they most likely keep confusing, or null.',
        'Do not fabricate facts beyond the supplied data. No markdown, no commentary outside the JSON.',
      ].join('\n'),
      input: JSON.stringify(input),
    })
    const parsed = parseJsonText(generated.text)
    if (parsed && typeof parsed.summary === 'string') {
      diagnosis = {
        summary: parsed.summary,
        pattern: parsed.pattern ?? `Pattern with ${concept.name} needs attention.`,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 3) : [],
        confusedWith: parsed.confusedWith ?? null,
      }
    }
  } catch {
    diagnosis = null
  }

  if (diagnosis) {
    return {
      conceptId,
      concept: { name: concept.name },
      mastery: masteryOut,
      insight: {
        summary: diagnosis.summary,
        pattern: diagnosis.pattern,
        reasons: diagnosis.reasons,
        evidence: evidenceOut.length ? evidenceOut : wrongAnswers.slice(0, maxEvidence).map((answer) => ({ source: 'quiz', detail: `${answer.prompt} — you answered "${answer.given}"`, at: answer.at, correct: false })),
        recommendations: recommendationSet({ concept, answers: quizAnswers, confusedWith: diagnosis.confusedWith, grounded }),
        grounded: Boolean(grounded),
      },
      evidenceCount: totalSignals,
      insufficientData: false,
      source: 'ai',
    }
  }

  const fallback = heuristicInsight({ concept, answers: quizAnswers, assessments, tutorQuestions, grounded })
  return {
    conceptId,
    concept: { name: concept.name },
    mastery: masteryOut,
    insight: fallback.insight,
    evidenceCount: totalSignals,
    insufficientData: false,
    source: 'heuristic',
  }
}

export { percent }