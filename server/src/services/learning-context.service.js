import { Assessment, Concept, Conversation, Mastery, Material, Message, Project, Quiz, QuizAttempt } from '../models/index.js'

const recentMessageLimit = 8
const materialLimit = 20
const conceptLimit = 30
const masteryLimit = 30
const assessmentLimit = 5
const quizAttemptLimit = 5
const maxMessageCharacters = 8000

function compactMessages(messages) {
  let remaining = maxMessageCharacters
  return messages.reverse().map((message) => {
    const content = message.content.slice(0, Math.min(message.content.length, remaining))
    remaining -= content.length
    return { role: message.role, content }
  }).filter((message) => message.content.length > 0)
}

export async function buildTutorContext({ projectId, userId, conversationId }) {
  const [project, materials, concepts, mastery, assessments, quizAttempts, conversation, recentMessages] = await Promise.all([
    Project.findById(projectId).select('title description learningGoal status').lean(),
    Material.find({ projectId, processingStatus: 'READY' }).select('title type metadata').limit(materialLimit).lean(),
    Concept.find({ projectId }).select('name description').limit(conceptLimit).lean(),
    Mastery.find({ projectId, userId }).sort({ score: 1 }).select('conceptId score level evidence').limit(masteryLimit).lean(),
    Assessment.find({ projectId, userId }).sort({ createdAt: -1 }).select('summary strengths gaps createdAt').limit(assessmentLimit).lean(),
    QuizAttempt.find({ projectId, userId }).sort({ createdAt: -1 }).limit(quizAttemptLimit).select('quizId score completedAt answers').lean(),
    conversationId ? Conversation.findOne({ _id: conversationId, projectId, userId }).select('title summary summaryUpdatedAt').lean() : Promise.resolve(null),
    conversationId ? Message.find({ conversationId, projectId }).sort({ createdAt: -1 }).limit(recentMessageLimit).select('role content').lean() : Promise.resolve([]),
  ])

  const conceptNames = new Map(concepts.map((concept) => [concept._id.toString(), concept.name]))
  const masteryContext = mastery.map((item) => ({
    concept: conceptNames.get(item.conceptId.toString()) ?? item.conceptId,
    score: item.score,
    level: item.level,
    evidence: item.evidence?.slice(0, 3) ?? [],
  }))

  return {
    projectKnowledge: {
      project,
      materials,
    },
    learnerContext: {
      learningGoal: project?.learningGoal,
      weakConcepts: masteryContext.filter((item) => item.score < 0.6),
      strongConcepts: masteryContext.filter((item) => item.score >= 0.6),
      recentAssessments: assessments,
      recentQuizResults: quizAttempts.map((attempt) => ({ quizId: attempt.quizId, score: attempt.score, completedAt: attempt.completedAt })),
    },
    shortTermContext: {
      conversationSummary: conversation?.summary ?? null,
      recentMessages: compactMessages(recentMessages),
    },
  }
}

export { recentMessageLimit, maxMessageCharacters }
