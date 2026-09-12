import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { connect, createProject, createSpace, createUser } from './helpers.mjs'
import env from '../src/config/env.js'

const stamp = `${Date.now()}-${process.pid}`
let seq = 0
const runId = () => `${stamp}-${seq++}`
const mongoose = await connect()
after(async () => { await mongoose.disconnect() })

function buildMinimalPdf(text) {
  const offsets = []
  let pos = 0
  const chunks = []

  function write(str) { chunks.push(str); pos += Buffer.byteLength(str, 'latin1') }
  function startObj(n) { offsets[n] = pos; write(`${n} 0 obj\n`) }
  function endObj() { write('endobj\n\n') }

  write('%PDF-1.4\n')

  startObj(1); write('<< /Type /Catalog /Pages 2 0 R >>\n'); endObj()
  startObj(2); write('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n'); endObj()
  startObj(3); write('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n'); endObj()

  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  startObj(4)
  write(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\n`)
  write('stream\n')
  write(stream + '\n')
  write('endstream\n')
  endObj()

  startObj(5); write('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n'); endObj()

  const xrefPos = pos
  write('xref\n')
  write('0 6\n')
  write('0000000000 65535 f \n')
  for (let i = 1; i <= 5; i++) write(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  write('trailer\n')
  write('<< /Root 1 0 R /Size 6 >>\n')
  write('startxref\n')
  write(`${xrefPos}\n`)
  write('%%EOF')

  return Buffer.from(chunks.join(''), 'latin1')
}

const knownText = 'binary search divides the search interval in half and targets the middle element'

test('PDF processing succeeds and creates chunks', async () => {
  const user = await createUser(mongoose, { email: `s20-worker-ok-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Worker Space')
  const project = await createProject(mongoose, user._id, space._id)

  const material = await mongoose.models.Material.create({ projectId: project._id, uploadedBy: user._id, title: 'Test PDF', type: 'pdf', processingStatus: 'UPLOADED' })
  const pdfBuffer = buildMinimalPdf(knownText)
  const storageKey = join('materials', `${material._id}.pdf`)
  const filePath = join(env.storageDirectory, storageKey)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, pdfBuffer)

  await mongoose.models.Material.findByIdAndUpdate(material._id, { storageKey })
  const job = await mongoose.models.ProcessingJob.create({ projectId: project._id, materialId: material._id })

  const { processMaterial } = await import('../src/services/material-processor.js')
  await processMaterial(material._id, job._id)

  const jobDoc = await mongoose.models.ProcessingJob.findById(job._id).lean()
  assert.equal(jobDoc.status, 'COMPLETED')
  assert.equal(jobDoc.progress, 100)
  assert.ok(jobDoc.completedAt)

  const materialDoc = await mongoose.models.Material.findById(material._id).lean()
  assert.equal(materialDoc.processingStatus, 'READY')

  const chunks = await mongoose.models.Chunk.find({ materialId: material._id }).sort({ chunkIndex: 1 }).lean()
  assert.ok(chunks.length >= 1, 'processing should produce at least one chunk')
  assert.ok(chunks[0].text.includes('binary search'), `chunk text should contain the seeded content: ${chunks[0].text}`)

  const activity = await mongoose.models.Activity.findOne({ projectId: project._id, type: 'MATERIAL_PROCESSED' }).lean()
  assert.ok(activity, 'MATERIAL_PROCESSED event should be recorded')
  assert.equal(activity.userId.toString(), user._id.toString(), 'event should record the uploading user')
})

test('failed job is handled gracefully with an error', async () => {
  const user = await createUser(mongoose, { email: `s20-worker-fail-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Fail Space')
  const project = await createProject(mongoose, user._id, space._id)

  const material = await mongoose.models.Material.create({ projectId: project._id, uploadedBy: user._id, title: 'Missing PDF', type: 'pdf', processingStatus: 'UPLOADED', storageKey: join('materials', `nonexistent-${stamp}.pdf`) })
  const job = await mongoose.models.ProcessingJob.create({ projectId: project._id, materialId: material._id })

  const { processMaterial } = await import('../src/services/material-processor.js')
  let caught = false
  try { await processMaterial(material._id, job._id) } catch { caught = true }
  assert.ok(caught, 'processMaterial should throw for a missing storage file')

  const jobDoc = await mongoose.models.ProcessingJob.findById(job._id).lean()
  assert.equal(jobDoc.status, 'FAILED')
  assert.ok(jobDoc.error, 'job should record the failure message')
  assert.ok(jobDoc.completedAt)

  const materialDoc = await mongoose.models.Material.findById(material._id).lean()
  assert.equal(materialDoc.processingStatus, 'FAILED')
  assert.ok(materialDoc.processingError, 'material should record the failure message')
})