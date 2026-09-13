import { Chunk, Concept } from '../models/index.js'
import { AIService } from './ai-provider-router.js'

const maxConcepts = 8
const keywordMinLength = 4
const promptCharLimit = 8000

const stopwords = new Set(['what', 'who', 'whom', 'whose', 'which', 'when', 'where', 'why', 'how', 'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'may', 'might', 'shall', 'should', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'from', 'as', 'into', 'than', 'then', 'that', 'this', 'these', 'those', 'it', 'its', 'there', 'their', 'they', 'he', 'she', 'we', 'you', 'your', 'our', 'has', 'have', 'had', 'having', 'not', 'no', 'nor', 'more', 'most', 'much', 'many', 'such', 'very', 'so', 'if', 'while', 'because', 'also', 'will', 'each', 'every', 'all', 'some', 'one', 'two', 'first', 'second', 'per', 'via', 'pdf', 'page', 'figure', 'table', 'section', 'chapter', 'lesson', 'unit', 'summary', 'introduction', 'conclusion', 'example', 'digitally', 'already', 'however', 'within', 'without', 'across', 'between', 'under', 'above', 'using', 'used', 'use', 'data', 'based', 'following', 'following'])

function normalizeName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function sentencesOf(text) {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean)
}

function keywordConcepts(text) {
  const sentences = sentencesOf(text)
  const counts = new Map()
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= keywordMinLength && !stopwords.has(word) && !/^\d+$/.test(word))
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  const candidates = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxConcepts).map(([word]) => word)
  return candidates.map((word) => {
    const sentence = sentences.find((item) => item.toLowerCase().includes(word))
    return { name: word, description: sentence ? sentence.slice(0, 220) : `Core concept "${word}" referenced throughout the learning material.` }
  })
}

function parseConcepts(output) {
  const cleaned = output.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No JSON array found in model output')
  const parsed = JSON.parse(cleaned.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('Model output is not a JSON array')
  return parsed
    .map(({ name, description }) => ({ name: normalizeName(name), description: String(description ?? '').trim().slice(0, 400) }))
    .filter((item) => item.name)
}

export async function extractConcepts({ projectId, materialId, text }) {
  const sourceText = String(text ?? '').trim()
  const chunks = await Chunk.find({ materialId }).select('_id').lean()
  const chunkIds = [...new Set(chunks.map((chunk) => chunk._id))]
  if (!sourceText) return { count: 0, concepts: [], chunkIds }

  let extracted
  try {
    const result = await AIService.generate({
      projectId,
      userId: null,
      operation: 'concept-extraction',
      instructions: 'You extract the key learning concepts from study material. Return ONLY a valid JSON array of objects with fields "name" (short phrase) and "description" (one to two sentences). List 3 to 8 concepts, based strictly on the supplied text. No markdown, no commentary, no trailing text.',
      input: `Study material:\n${sourceText.slice(0, promptCharLimit)}`,
    })
    extracted = parseConcepts(result.text)
    if (!extracted.length) throw new Error('No concepts parsed from model output')
  } catch (error) {
    console.warn(`[concept-extraction] model extraction failed, using keyword fallback: ${error.message}`)
    extracted = keywordConcepts(sourceText)
  }

  const concepts = extracted.slice(0, maxConcepts)
  await Concept.updateMany({ projectId, materialId }, { $set: { sourceChunkIds: [] } })
  for (const concept of concepts) {
    await Concept.updateOne(
      { projectId, name: concept.name },
      { $set: { description: concept.description, materialId }, $addToSet: { sourceChunkIds: { $each: chunkIds } } },
      { upsert: true },
    )
  }

  const saved = await Concept.find({ projectId, materialId }).select('name').lean()
  return { count: saved.length, concepts, chunkIds }
}