import { useEffect, useState } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

const fallbackHealth = [
  { label: 'API', status: 'ready', detail: 'Express REST boundary' },
  { label: 'Database', status: 'ready', detail: 'MongoDB · Atlas' },
  { label: 'Redis', status: 'ready', detail: 'Cache + job worker' },
  { label: 'AI', status: 'ready', detail: 'Groq + Gemini' },
  { label: 'Worker', status: 'ready', detail: 'Background processing' },
]

const fallbackAiUsage = { requests: 0, successful: 0, failed: 0, averageLatencySec: 0, estimatedCost: 0, byOperation: [] }

const fallbackUsers = [
  { _id: '1', name: 'Thanush Reddy', email: 'thanushreddy934@gmail.com', role: 'ADMIN', lastActiveAt: null, activity: 4, projects: 1, spaces: 1, quizAttempts: 0, conversations: 2 },
  { _id: '2', name: 'Aarav Mehta', email: 'aarav@test.dev', role: 'USER', lastActiveAt: null, activity: 2, projects: 0, spaces: 1, quizAttempts: 0, conversations: 0 },
]

const fallbackDetail = {
  user: { _id: '1', name: 'Thanush Reddy', email: 'thanushreddy934@gmail.com', role: 'ADMIN' },
  spaces: [{ _id: 's1', name: 'Computer Science', projectCount: 1 }],
  projects: [{ _id: 'p1', title: 'Operating systems', status: 'active', learningGoal: 'Explain core concepts without memorizing definitions.' }],
  activity: { total: 6, byType: [{ type: 'SPACE_CREATED', count: 1 }, { type: 'TUTOR_QUESTION', count: 5 }] },
  learningAnalytics: { averageMastery: 45, masteryRecords: [], quizAccuracy: 70, quizAttempts: 2, assessmentCount: 1, tutorRequests: 5 },
  aiUsage: { requests: 0, successful: 0, failed: 0, averageLatencySec: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
}

async function get(path) {
  const headers = { 'Content-Type': 'application/json' }
  const token = window.localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function Hp({ label, detail, status }) {
  return (
    <div className="admin-health-card">
      <span className="health-dot" data-status={status === 'ready' || status === 'online' ? 'ok' : 'bad'} />
      <strong>{label}</strong><small>{detail}</small><code>{status}</code>
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

function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState(null)
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('live')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`${BASE}/api/admin/overview`).then((r) => r.ok && r.json()),
      fetch(`${BASE}/api/admin/users?limit=25`).then((r) => r.ok && r.json()),
    ])
      .then(([overviewData, userData]) => {
        if (cancelled) return
        if (overviewData?.health && userData?.users) {
          setMode('live')
          setOverview({ health: healthRows(overviewData.health), aiUsage: overviewData.aiUsage })
          setUsers(userData.users)
        } else {
          setMode('sample')
          setOverview({ health: fallbackHealth, aiUsage: fallbackAiUsage })
          setUsers(fallbackUsers)
        }
      })
      .catch(() => {
        if (cancelled) return
        setMode('sample')
        setOverview({ health: fallbackHealth, aiUsage: fallbackAiUsage })
        setUsers(fallbackUsers)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selected || mode === 'sample') return
    let cancelled = false
    fetch(`${BASE}/api/admin/users/${selected._id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((detail) => { if (!cancelled && detail?.user) setSelected(detail) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [selected?._id])

  const aiUsage = overview?.aiUsage ?? fallbackAiUsage
  const isSample = mode === 'sample'
  const fetchDetail = async (userId) => {
    try {
      const detail = await get(`/api/admin/users/${userId}`)
      setSelected(detail.user ? detail : fallbackDetail)
    } catch {
      setSelected(fallbackDetail)
    }
  }

  return (
    <div className="analytics-dashboard">
      <div className="admin-banner">
        <div><p className="eyebrow">Admin console</p><h2>System health & usage</h2><p className="lede small">{isSample ? 'Showing sample data' : 'Live telemetry from the running stack'}</p></div>
        <div className="admin-toolbar"><button className={`analytics-tabs ${mode === 'live' ? 'active' : ''}`}>LIVE</button><button className="analytics-tabs">SAMPLE</button></div>
      </div>

      <div className="admin-health-grid">
        {(overview?.health ?? fallbackHealth).map((item) => <Hp key={item.label} {...item} />)}
      </div>

      <div className="section-heading" style={{ marginTop: 44 }}><div><span className="section-label">AI usage</span><h2>Model telemetry</h2></div></div>
      <div className="analytics-stat-grid">
        <Stat label="Total requests" value={aiUsage.requests.toLocaleString()} detail="All AI calls across operations" />
        <Stat label="Successful" value={aiUsage.successful.toLocaleString()} detail="Completed provider calls" />
        <Stat label="Failed" value={aiUsage.failed.toLocaleString()} detail="Recorded errors" />
        <Stat label="Avg latency" value={`${aiUsage.averageLatencySec ?? 0}s`} detail="Per request earlier" />
      </div>
      <div className="analytics-stat-strip">
        <Stat label="Estimated cost" value={`$${(aiUsage.estimatedCost ?? 0).toFixed(4)}`} detail="Cumulative provider spend" />
        <Stat label="Input tokens" value={(aiUsage.inputTokens ?? 0).toLocaleString()} detail="Prompt consumption" />
        <Stat label="Output tokens" value={(aiUsage.outputTokens ?? 0).toLocaleString()} detail="Completion production" />
        <Stat label="Operations" value={(aiUsage.byOperation ?? []).length} detail="Distinct AI operations" />
      </div>

      <div className="section-heading" style={{ marginTop: 44 }}><div><span className="section-label">Users</span><h2>Accounts in the system</h2></div><span className="mono-label">{users?.length ?? 0} shown</span></div>
      <div className="admin-user-table">
        {users?.map((user) => (
          <button className="admin-user-row" key={user._id} onClick={() => { setSelected(user); fetchDetail(user._id) }}>
            <span>{user.name}</span><small>{user.email}</small><code>{user.role}</code><strong>{user.spaces ?? 0}</strong><strong>{user.projects ?? 0}</strong><strong>{user.activity ?? 0}</strong><em>→</em>
          </button>
        ))}
      </div>
      {!users && <div className="analytics-empty">Loading users…</div>}

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
            <div className="analytics-chart-panel"><span className="section-label">Activity</span><ul className="admin-activity-list">{(selected.activity?.byType ?? []).map((row) => <li key={row.type}><span>{row.type}</span><strong>{row.count}</strong></li>)}</ul></div>
            <div className="analytics-chart-panel"><span className="section-label">AI usage</span><div className="analytics-stat-strip single"><Stat label="Requests" value={selected.aiUsage?.requests ?? 0} detail="Lifetime calls" /><Stat label="Cost" value={`$${(selected.aiUsage?.estimatedCost ?? 0).toFixed(4)}`} detail="Estimated spend" /><Stat label="Latency" value={`${selected.aiUsage?.averageLatencySec ?? 0}s`} detail="Average" /></div></div>
          </div>
          <div className="analytics-chart-panel wide" style={{ marginTop: 14 }}><span className="section-label">Projects</span><div className="project-list">{selected.projects?.map((project) => <div className="project-row" key={project._id}><div className="project-index">{project.status}</div><div><h2>{project.title}</h2><p>{project.learningGoal ?? 'No learning goal set'}</p></div><span className="project-arrow">→</span></div>)}</div></div>
        </div>
      )}
    </div>
  )
}

function healthRows(health) {
  const detail = { api: 'Express REST boundary', database: 'MongoDB connection pool', redis: 'Cache + queue backend', ai: 'Provider credentials', worker: 'Background job dispatcher' }
  return Object.keys(detail).map((key) => ({ label: key === 'ai' ? 'AI' : key === 'api' ? 'API' : key === 'worker' ? 'Worker' : key === 'database' ? 'Database' : 'Redis', detail: detail[key], status: health[key] ?? 'unknown' }))
}

export default AdminDashboard