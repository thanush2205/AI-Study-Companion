import { PDFParse } from 'pdf-parse'
import { Chunk, Material } from '../models/index.js'

const chunkSize = 1200
const chunkOverlap = 150

function splitText(text) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const chunks = []
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const content = normalized.slice(start, end).trim()
    if (content) chunks.push(content)
    if (end === normalized.length) break
    start = end - chunkOverlap
  }

  return chunks
}

export async function processMaterial(materialId, buffer) {
  await Material.findByIdAndUpdate(materialId, { processingStatus: 'PROCESSING', processingError: null })

  try {
    const parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    await parser.destroy()
    const contents = splitText(parsed.text)
    if (!contents.length) throw new Error('No readable text found in PDF')

    const material = await Material.findById(materialId).select('projectId').lean()
    await Chunk.deleteMany({ materialId })
    await Chunk.insertMany(contents.map((content, chunkIndex) => ({
      projectId: material.projectId,
      materialId,
      chunkIndex,
      content,
      tokenCount: Math.ceil(content.length / 4),
    })))

    await Material.findByIdAndUpdate(materialId, {
      processingStatus: 'READY',
      metadata: { pageCount: parsed.total, characterCount: parsed.text.length, chunkCount: contents.length },
    })
  } catch (error) {
    await Material.findByIdAndUpdate(materialId, { processingStatus: 'FAILED', processingError: error.message })
  }
}
