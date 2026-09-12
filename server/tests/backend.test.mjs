import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, api } from './helpers.mjs'

const stamp = Date.now()

async function serverStatus() {
  try {
    const response = await fetch(`${BASE}/api/ready`, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) return null
    const json = await response.json()
    return json.status === 'ready' ? json : null
  } catch {
    return null
  }
}

const ready = await serverStatus()
const skip = ready ? false : 'API server not reachable — start it with `npm run dev` in server/'

test('register creates a user and returns a token', { skip }, async () => {
  const email = `s20-auth-${stamp}@test.dev`
  const { status, json } = await api('/api/auth/register', { method: 'POST', body: { email, name: 'Auth Tester', password: 'password123' } })
  assert.equal(status, 201)
  assert.ok(json.token)
  assert.equal(json.user.email, email)
  assert.ok(json.user.id)
})

test('login authenticates with valid credentials', { skip }, async () => {
  const email = `s20-login-${stamp}@test.dev`
  await api('/api/auth/register', { method: 'POST', body: { email, name: 'Login Tester', password: 'password123' } })
  const { status, json } = await api('/api/auth/login', { method: 'POST', body: { email, password: 'password123' } })
  assert.equal(status, 200)
  assert.ok(json.token)
  assert.equal(json.user.email, email)
})

test('login rejects wrong credentials', { skip }, async () => {
  const email = `s20-wrong-${stamp}@test.dev`
  await api('/api/auth/register', { method: 'POST', body: { email, name: 'Login Tester', password: 'password123' } })
  const { status } = await api('/api/auth/login', { method: 'POST', body: { email, password: 'wrongggg' } })
  assert.equal(status, 401)
})

test('unauthorized request is rejected', { skip }, async () => {
  const { status, json } = await api('/api/auth/me')
  assert.equal(status, 401)
  assert.match(json.error, /auth/i)
})

test('authenticated user can read their own profile', { skip }, async () => {
  const email = `s20-me-${stamp}@test.dev`
  const { json: registered } = await api('/api/auth/register', { method: 'POST', body: { email, name: 'Me Tester', password: 'password123' } })
  const { status, json } = await api('/api/auth/me', { token: registered.token })
  assert.equal(status, 200)
  assert.equal(json.user.id, registered.user.id)
})

test('user cannot access another user\'s project', { skip }, async () => {
  const a = await api('/api/auth/register', { method: 'POST', body: { email: `s20-owner-${stamp}@test.dev`, name: 'Owner', password: 'password123' } })
  const b = await api('/api/auth/register', { method: 'POST', body: { email: `s20-tres-${stamp}@test.dev`, name: 'Trespasser', password: 'password123' } })

  const space = await api('/api/spaces', { method: 'POST', body: { name: 'Owner Space' }, token: a.json.token })
  assert.equal(space.status, 201)
  const project = await api(`/api/spaces/${space.json.space._id}/projects`, { method: 'POST', body: { title: 'Owner Project' }, token: a.json.token })
  assert.equal(project.status, 201)

  const intrusion = await api(`/api/projects/${project.json.project._id}`, { token: b.json.token })
  assert.equal(intrusion.status, 404)
  assert.match(intrusion.json.error, /not found/i)
})

test('invalid project id is rejected with 400', { skip }, async () => {
  const registered = await api('/api/auth/register', { method: 'POST', body: { email: `s20-invalid-${stamp}@test.dev`, name: 'Invalid Tester', password: 'password123' } })
  const { status, json } = await api('/api/projects/not-a-valid-id', { token: registered.json.token })
  assert.equal(status, 400)
  assert.match(json.error, /valid projectId/i)
})

test('nonexistent project id is rejected with 404', { skip }, async () => {
  const registered = await api('/api/auth/register', { method: 'POST', body: { email: `s20-missing-${stamp}@test.dev`, name: 'Missing Tester', password: 'password123' } })
  const { status } = await api('/api/projects/64b0fcfc6b4b5c9d1a1a1a1a', { token: registered.json.token })
  assert.equal(status, 404)
})