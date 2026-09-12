import { PDFParse } from 'pdf-parse'
import { Chunk, Material } from '../models/index.js'
import { ProcessingJob } from '../models/index.js'
import { readMaterialFile } from './material-storage.js'
import { generateEmbedding } from './embedding.service.js'
import { EVENTS, recordEvent } from './event.service.js'

const chunkSize = 1200
const chunkOverlap = 150

function splitText(text, pageNumber) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const chunks = []
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const content = normalized.slice(start, end).trim()
    if (content) chunks.push({ content, pageNumber })
    if (end === normalized.length) break
    start = end - chunkOverlap
  }

  return chunks
}

export async function processMaterial(materialId, jobId) {
  const job = await ProcessingJob.findByIdAndUpdate(jobId, {
    status: 'PROCESSING', progress: 10, startedAt: new Date(), $inc: { attempts: 1 }, error: null,
  }, { new: true })
  const material = await Material.findByIdAndUpdate(materialId, { processingStatus: 'PROCESSING', processingError: null }, { new: true }).select('projectId storageKey uploadedBy')

  try {
    await ProcessingJob.findByIdAndUpdate(job._id, { progress: 25 })
    const parser = new PDFParse({ data: await readMaterialFile(material.storageKey) })
    const parsed = await parser.getText()
    await parser.destroy()
    await ProcessingJob.findByIdAndUpdate(job._id, { progress: 55 })
    const pages = parsed.pages?.length ? parsed.pages : [{ num: 1, text: parsed.text }]
    const contents = pages.flatMap((page) => splitText(page.text, page.num))
    if (!contents.length) throw new Error('No readable text found in PDF')

    await Chunk.deleteMany({ materialId })
    await Chunk.insertMany(contents.map(({ content, pageNumber }, chunkIndex) => ({
      projectId: material.projectId,
      materialId,
      chunkIndex,
      text: content,
      content,
      pageNumber,
      tokenCount: Math.ceil(content.length / 4),
      embedding: generateEmbedding(content),
    })))

    await Material.findByIdAndUpdate(materialId, {
      processingStatus: 'READY',
      metadata: { pageCount: parsed.total, characterCount: parsed.text.length, chunkCount: contents.length },
    })
    await ProcessingJob.findByIdAndUpdate(job._id, { status: 'COMPLETED', progress: 100, completedAt: new Date() })
    await recordEvent({
      type: EVENTS.MATERIAL_PROCESSED,
      projectId: material.projectId,
      userId: material.uploadedBy ?? null,
      entityType: 'Material',
      entityId: materialId,
      metadata: { chunkCount: contents.length, pageCount: parsed.total },
    })
  } catch (error) {
    await Material.findByIdAndUpdate(materialId, { processingStatus: 'FAILED', processingError: error.message })
    await ProcessingJob.findByIdAndUpdate(job._id, { status: 'FAILED', error: error.message, completedAt: new Date() })
    throw error
  }
}
