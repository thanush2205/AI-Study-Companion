import express from 'express'
import { Quiz } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireQuizAccess } from '../middleware/quiz-access.js'
import { evaluateQuiz, publicQuiz } from '../services/quiz-engine.js'

const router = express.Router()

router.post('/quizzes/:quizId/attempts', authenticate, requireQuizAccess, async (request, response, next) => {
  try {
    const result = await evaluateQuiz({ quiz: request.quiz, projectId: request.scope.projectId, userId: request.user._id, answers: request.body.answers })
    return response.json(result)
  } catch (error) {
    return next(error)
  }
})

router.get('/quizzes/:quizId', authenticate, requireQuizAccess, (request, response) => {
  response.json({ quiz: publicQuiz(request.quiz) })
})

export default router
