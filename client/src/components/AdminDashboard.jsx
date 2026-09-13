import { useEffect, useState } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function request(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = window.localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

const get = (path) => request(path)
const postJson = (path, body) => request(path, 'POST', body)

const healthMeta = {
  api: { label: 'API', detail: 'Express REST boundary' },
  database: { label: 'Database', detail: 'MongoDB connection pool' },
  redis: { label: 'Redis', detail: 'Cache + queue backend' },
  ai: { label: 'AI', detail: 'Provider credentials' },
  worker: { label: 'Worker', detail: 'Background job dispatcher' },
}

function Hp({ label, detail, status }) {
  return (
    <div className="admin-health-card">
      <span className="health-dot" data-status={status === 'ready' || status === 'online' ? 'ok' : 'bad'} />
      <strong>{label}</strong><small>{detail}</small><code>{status ?? 'unknown'}</code>
    </div>
  )
}

function Stat({ label, value, detail }) {
  return (
    <div className="analytics-stat">
      <span className="section-label">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  )
}

function AdminDashboard({ user }) {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState(null)
  const [selected, setSelected] = useState(null)
  const [evaluations, setEvaluations] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  const loadAll = async () => {
    setError(null)
    const results = await Promise.all([
      get('/api/admin/overview').then((data) => ({ key: 'overview', data: { health: healthRows(data.health), aiUsage: data.aiUsage } })).catch((error) => ({ key: 'overview', error })),
      get('/api/admin/users?limit=25').then((data) => ({ key: 'users', data: data.users ?? null })).catch((error) => ({ key: 'users', error })),
      get('/api/admin/evaluation?limit=3').then((data) => ({ key: 'evaluations', data: data.runs ?? null })).catch((error) => ({ key: 'evaluations', error })),
    ])
    for (const result of results) {
      if (result.key === 'overview' && result.data) setOverview(result.data)
      if (result.key === 'users' && result.data) setUsers(result.data)
      if (result.key === 'evaluations' && result.data) setEvaluations(result.data)
    }
    const failed = results.filter((result) => !result.data)
    if (failed.length) {
      const firstStatus = failed[0].error?.status
      setError(firstStatus === 401
        ? 'Your session is invalid or expired — sign out and sign back in.'
        : firstStatus === 403
          ? 'This account is not an admin (server returned 403).'
          : `Admin API unreachable — is the API running? (${failed[0].error?.message ?? 'unknown error'})`)
    }
  }

  useEffect(() => { if (user?.role === 'ADMIN') loadAll() }, [user?.role])

  const fetchDetail = async (userId) => {
    try {
      const detail = await get(`/api/admin/users/${userId}`)
      setSelected(detail.user ? detail : null)
    } catch (error) {
      setError(error.status === 403
        ? 'Drill-down failed — this account needs ADMIN role on the server.'
        : 'Could not load the user drill-down.')
    }
  }

  const runSuite = async () => {
    setRunning(true)
    setError(null)
    try {
      await postJson('/api/admin/evaluation/run', {})
      const data = await get('/api/admin/evaluation?limit=3')
      setEvaluations(data.runs ?? [])
    } catch {
      setError('Evaluation run failed — check that the AI providers are configured.')
    } finally {
      setRunning(false)
    }
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="analytics-dashboard">
        <div className="admin-banner">
          <div><p className="eyebrow">Admin console</p><h2>Admin access required</h2><p className="lede small">This area is restricted to ADMIN accounts.</p></div>
        </div>
      </div>
    )
  }

  const aiUsage = overview?.aiUsage
  const health = overview?.health ?? []

  return (
    <div className="analytics-dashboard">
      <div className="admin-banner">
        <div><p className="eyebrow">Admin console</p><h2>System health & usage</h2><p className="lede small">Live telemetry from the running stack</p></div>
        {error && <p className="insight-error">{error}</p>}
      </div>

      <div className="admin-health-grid">
        {health.length ? health.map((item) => <Hp key={item.label} {...item} />) : <div className="analytics-empty">System health unavailable — are you signed in as admin?</div>}
      </div>

      <div className="section-heading" style={{ marginTop: 44 }}><div><span className="section-label">AI usage</span><h2>Model telemetry</h2></div></div>
      <div className="analytics-stat-grid">
        <Stat label="Total requests" value={(aiUsage?.requests ?? 0).toLocaleString()} detail="All AI calls across operations" />
        <Stat label="Successful" value={(aiUsage?.successful ?? 0).toLocaleString()} detail="Completed provider calls" />
        <Stat label="Failed" value={(aiUsage?.failed ?? 0).toLocaleString()} detail="Recorded errors" />
        <Stat label="Avg latency" value={`${aiUsage?.averageLatencySec ?? 0}s`} detail="Per request" />
      </div>
      <div className="analytics-stat-strip">
        <Stat label="Estimated cost" value={`$${(aiUsage?.estimatedCost ?? 0).toFixed(4)}`} detail="Cumulative provider spend" />
        <Stat label="Input tokens" value={(aiUsage?.inputTokens ?? 0).toLocaleString()} detail="Prompt consumption" />
        <Stat label="Output tokens" value={(aiUsage?.outputTokens ?? 0).toLocaleString()} detail="Completion production" />
        <Stat label="Operations" value={(aiUsage?.byOperation ?? []).length} detail="Distinct AI operations" />
      </div>

      <div className="section-heading" style={{ marginTop: 44 }}><div><span className="section-label">AI evaluation</span><h2>Groundedness checks</h2></div><button className="secondary-action" onClick={runSuite} disabled={running}>{running ? 'Running…' : 'Run evaluation'} <span>→</span></button></div>
      <div className="analytics-chart-grid">
        {(evaluations ?? []).map((run) => (
          <div className="analytics-chart-panel" key={run.runId}>
            <span className="section-label">Run · {String(run.createdAt ?? '').slice(0, 10)}</span>
            <div className="analytics-stat-strip single" style={{ marginTop: 10 }}>
              <Stat label="Pass rate" value={`${run.summary?.passRate ?? 0}%`} detail={`${run.summary?.passed ?? 0}/${run.summary?.total ?? 0} cases`} />
              <Stat label="Grounded" value={`${run.summary?.groundedRate ?? 0}%`} detail={`${run.summary?.groundedCount ?? 0} answers cited`} />
              <Stat label="Refusal" value={`${run.summary?.refusalRate ?? 0}%`} detail="Unsupported questions refused" />
            </div>
            <ul className="admin-activity-list" style={{ marginTop: 8 }}>
              {(run.cases ?? []).map((caseItem) => (
                <li key={caseItem._id}>
                  <span>{caseItem.category} · {caseItem.expected} → {caseItem.actual}{caseItem.error ? ` (${caseItem.error})` : ''}</span>
                  <strong>{caseItem.correct ? '✓' : '✗'}</strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!evaluations && <div className="analytics-empty">No evaluation runs yet — run one to verify grounded answering, citations, and refusals.</div>}
      </div>

      <div className="section-heading" style={{ marginTop: 44 }}><div><span className="section-label">Users</span><h2>Accounts in the system</h2></div><span className="mono-label">{users?.length ?? 0} shown</span></div>
      <div className="admin-user-table">
        {users?.map((user) => (
          <button className="admin-user-row" key={user._id} onClick={() => { setSelected(user); fetchDetail(user._id) }}>
            <span>{user.name}</span><small>{user.email}</small><code>{user.role}</code><strong>{user.spaces ?? 0}</strong><strong>{user.projects ?? 0}</strong><strong>{user.activity ?? 0}</strong><em>→</em>
          </button>
        ))}
        {!users && <div className="analytics-empty">Loading users…</div>}
      </div>

      {selected?.user && (
        <div className="admin-detail">
          <div className="section-heading" style={{ marginTop: 44 }}><div><span className="section-label">Drill-down</span><h2>{selected.user.name}</h2><p className="lede small">{selected.user.email} · {selected.user.role}</p></div><button className="text-action" onClick={() => setSelected(null)}>Close ×</button></div>
          <div className="analytics-stat-grid">
            <Stat label="Spaces" value={selected.spaces?.length ?? 0} detail="Active learning spaces" />
            <Stat label="Projects" value={selected.projects?.length ?? 0} detail="Across spaces" />
            <Stat label="Avg mastery" value={`${selected.learningAnalytics?.averageMastery ?? 0}%`} detail="Across concepts" />
            <Stat label="Quiz accuracy" value={`${selected.learningAnalytics?.quizAccuracy ?? 0}%`} detail={`${selected.learningAnalytics?.quizAttempts ?? 0} attempts`} />
          </div>
          <div className="analytics-chart-grid">
            <div className="analytics-chart-panel"><span className="section-label">Activity</span><ul className="admin-activity-list">{(selected.activity?.byType ?? []).map((row) => <li key={row.type}><span>{row.type}</span><strong>{row.count}</strong></li>)}</ul>{!selected.activity?.byType?.length && <div className="analytics-empty">No activity recorded.</div>}</div>
            <div className="analytics-chart-panel"><span className="section-label">AI usage</span><div className="analytics-stat-strip single"><Stat label="Requests" value={selected.aiUsage?.requests ?? 0} detail="Lifetime calls" /><Stat label="Cost" value={`$${(selected.aiUsage?.estimatedCost ?? 0).toFixed(4)}`} detail="Estimated spend" /><Stat label="Latency" value={`${selected.aiUsage?.averageLatencySec ?? 0}s`} detail="Average" /></div></div>
          </div>
          <div className="analytics-chart-panel wide" style={{ marginTop: 14 }}><span className="section-label">Projects</span>{selected.projects?.length ? <div className="project-list">{selected.projects.map((project) => <div className="project-row" key={project._id}><div className="project-index">{project.status}</div><div><h2>{project.title}</h2><p>{project.learningGoal ?? 'No learning goal set'}</p></div><span className="project-arrow">→</span></div>)}</div> : <div className="analytics-empty">No projects yet.</div>}</div>
        </div>
      )}
    </div>
  )
}

function healthRows(health) {
  return Object.entries(healthMeta).map(([key, meta]) => ({ label: meta.label, detail: meta.detail, status: health[key] ?? 'unknown' }))
}

export default AdminDashboard