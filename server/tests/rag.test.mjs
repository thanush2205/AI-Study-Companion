import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { connect, createConcept, createProject, createSpace, createUser, seedMaterialChunks } from './helpers.mjs'

const stamp = `${Date.now()}-${process.pid}`
let seq = 0
const runId = () => `${stamp}-${seq++}`
const mongoose = await connect()
after(async () => { await mongoose.disconnect() })

test('RAG: retrieves the relevant chunk for a covered question', async () => {
  const user = await createUser(mongoose, { email: `s20-rag-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'RAG Space')
  const project = await createProject(mongoose, user._id, space._id)
  const { chunks: seeded, material } = await seedMaterialChunks(mongoose, project._id, [
    'Inheritance is a core concept of object-oriented programming where a child class inherits attributes and methods from a parent class.',
    'Binary search is an efficient algorithm for finding a target value in a sorted list.',
  ])

  const { retrieveEvidence } = await import('../src/services/knowledge-engine.js')
  const { evidence } = await retrieveEvidence({ projectId: project._id, question: 'What is inheritance in object oriented programming?' })

  assert.ok(evidence.length >= 1, 'expected at least one retrieved chunk')
  const anchored = evidence.some((chunk) => chunk._id.toString() === seeded[0]._id.toString())
  assert.ok(anchored, 'expected the relevant chunk to be retrieved')
  const allFromMaterial = evidence.every((chunk) => chunk.materialId.toString() === material._id.toString())
  assert.ok(allFromMaterial, 'all retrieved chunks should come from this project')
})

test('RAG: retrieval is scoped to the project', async () => {
  const user = await createUser(mongoose, { email: `s20-scope-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Scope Space')
  const projectA = await createProject(mongoose, user._id, space._id)
  const projectB = await createProject(mongoose, user._id, space._id)

  const materialA = await seedMaterialChunks(mongoose, projectA._id, [
    'Inheritance is a core concept of object-oriented programming where a child class inherits attributes and methods from a parent class.',
  ])
  const materialB = await seedMaterialChunks(mongoose, projectB._id, [
    'Inheritance appears across languages; a child class inherits attributes and methods from a parent class in object oriented programming.',
  ])

  const { retrieveEvidence } = await import('../src/services/knowledge-engine.js')
  const a = await retrieveEvidence({ projectId: projectA._id, question: 'What is inheritance in object oriented programming?' })
  const b = await retrieveEvidence({ projectId: projectB._id, question: 'What is inheritance in object oriented programming?' })

  assert.ok(a.evidence.length >= 1)
  assert.ok(a.evidence.every((chunk) => chunk.materialId.toString() === materialA.material._id.toString()),
    'project A must never retrieve project B chunks')
  assert.ok(b.evidence.length >= 1)
  assert.ok(b.evidence.every((chunk) => chunk.materialId.toString() === materialB.material._id.toString()),
    'project B must never retrieve project A chunks')
})

test('RAG: grounded answer generates citations', async () => {
  const user = await createUser(mongoose, { email: `s20-cite-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Cite Space')
  const project = await createProject(mongoose, user._id, space._id)
  await seedMaterialChunks(mongoose, project._id, [
    'Binary search is an efficient algorithm for finding a target value in a sorted list. It repeatedly divides the search interval in half.',
  ])
  await createConcept(mongoose, project._id, 'Algorithms', 'Binary search and friends.')

  const { answerQuestion } = await import('../src/services/knowledge-engine.js')
  const result = await answerQuestion({ projectId: project._id, userId: user.id, question: 'How does binary search work on a sorted list?' })

  assert.equal(result.responseType, 'grounded-answer')
  assert.equal(result.refused, false)
  assert.ok(result.evidenceCount >= 1)
  assert.ok(Array.isArray(result.citations) && result.citations.length >= 1, 'expected citations on a grounded answer')
  assert.ok(result.answer.includes('Sources'), 'grounded answer should append a Sources block')
})

test('RAG: unsupported question is refused without citation', async () => {
  const user = await createUser(mongoose, { email: `s20-refuse-${runId()}@test.dev` })
  const space = await createSpace(mongoose, user._id, 'Refuse Space')
  const project = await createProject(mongoose, user._id, space._id)
  await seedMaterialChunks(mongoose, project._id, [
    'Binary search is an efficient algorithm for finding a target value in a sorted list.',
  ])

  const { answerQuestion } = await import('../src/services/knowledge-engine.js')
  const result = await answerQuestion({ projectId: project._id, userId: user.id, question: 'Who won the 1902 world cup?' })

  assert.equal(result.responseType, 'refusal')
  assert.equal(result.refused, true)
  assert.equal(result.evidenceCount, 0)
  assert.equal(result.citations.length, 0, 'a refusal must not carry citations')
})