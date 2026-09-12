import { useEffect, useRef, useState } from 'react'
import AnalyticsDashboard from './AnalyticsDashboard'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

const navSections = [
  { key: 'overview', label: 'Overview', icon: '◫' },
  { key: 'materials', label: 'Materials', icon: '📄' },
  { key: 'tutor', label: 'AI Tutor', icon: '✦' },
  { key: 'quiz', label: 'Quiz', icon: '◆' },
  { key: 'assessment', label: 'Assessment', icon: '◎' },
  { key: 'mastery', label: 'Mastery', icon: '↗' },
  { key: 'growth', label: 'Growth', icon: '✵' },
  { key: 'analytics', label: 'Analytics', icon: '▤' },
]

const statusTone = {
  READY: 'ok',
  QUEUED: 'wait',
  PROCESSING: 'wait',
  UPLOADED: 'wait',
  FAILED: 'bad',
}

async function get(path, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

const sampleMaterials = [
  { _id: 'm1', title: 'OOP.pdf', processingStatus: 'READY', createdAt: '2025-11-02', metadata: { chunkCount: 12 } },
  { _id: 'm2', title: 'Polymorphism notes', processingStatus: 'READY', createdAt: '2025-11-09', metadata: { chunkCount: 4 } },
]

const sampleConcepts = [
  { concept: 'Classes', masteryPercent: 92 },
  { concept: 'Inheritance', masteryPercent: 87 },
  { concept: 'Polymorphism', masteryPercent: 74 },
  { concept: 'Interfaces', masteryPercent: 36 },
  { concept: 'Abstraction', masteryPercent: 48 },
]

const sampleQuiz = {
  questions: [
    { _id: 'q1', prompt: 'Which keyword marks a method as usable without an instance?', options: ['static', 'final', 'void', 'public'], answer: 'static' },
    { _id: 'q2', prompt: 'What is the term for a class acquiring behavior from a parent?', options: ['Inheritance', 'Overloading', 'Encapsulation', 'Polymorphism'], answer: 'Inheritance' },
  ],
}

export default function ProjectWorkspace({ project, token }) {
  const [active, setActive] = useState('tutor')
  const [materials, setMaterials] = useState(null)
  const [concepts, setConcepts] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const projectId = project.id ?? project._id

  useEffect(() => {
    let alive = true
    async function load() {
      const fallbackAnalytics = {
        sessions: { total: 12, tutorQuestions: 34, tutorAnswers: 29, totalMessages: 65, averageMessagesPerSession: 5.4 },
        quiz: { attempts: 18, averageScore: 74, answers: 72, correctAnswers: 53, accuracy: 74 },
        mastery: {
          trackedConcepts: 5, averageMastery: 64,
          levelDistribution: { mastered: 2, proficient: 1, developing: 1, novice: 1 },
          masteredConceptNames: ['Classes', 'Inheritance'],
          conceptsNeedingAttentionNames: ['Interfaces', 'Abstraction'],
        },
        activity: { total: 42, byType: [] },
        aiUsage: { calls: 61, inputTokens: 48200, outputTokens: 12600, cost: 0.0214, byOperation: [] },
        masteryTrend: [
          { week: 'Week 1', masteryPercent: 38 },
          { week: 'Week 2', masteryPercent: 52 },
          { week: 'Week 3', masteryPercent: 64 },
          { week: 'Week 4', masteryPercent: 71 },
        ],
      }
      setConcepts(Object.freeze(sampleConcepts))
      if (!projectId || !token) {
        setMaterials(sampleMaterials)
        setAnalytics(fallbackAnalytics)
        return
      }
      try {
        const [materialData, analyticsData] = await Promise.all([
          get(`/api/projects/${projectId}/materials`, token).catch(() => null),
          get(`/api/projects/${projectId}/analytics`, token).catch(() => null),
        ])
        if (!alive) return
        if (materialData?.materials) setMaterials(materialData.materials)
        if (analyticsData?.analytics) {
          setAnalytics({ ...fallbackAnalytics, ...analyticsData.analytics, masteryTrend: analyticsData.analytics.masteryTrend?.length ? analyticsData.analytics.masteryTrend?.map((p) => ({ week: p.period ?? p.week ?? 'Week', masteryPercent: p.masteryPercent ?? p.averageMastery ?? 0 })) : fallbackAnalytics.masteryTrend })
        }
      } catch {
        if (alive) { setMaterials(sampleMaterials); setAnalytics(fallbackAnalytics) }
      }
    }
    load()
    return () => { alive = false }
  }, [projectId, token])

  const mastery = analytics?.mastery ?? {}
  const view = { project, token }

  return (
    <div className="project-workspace">
      <aside className="project-rail">
        <div className="rail-heading">
          <p className="eyebrow">Project workspace</p>
          <h2>{project.title ?? 'Untitled project'}</h2>
          <p className="rail-goal">Goal · {project.learningGoal ?? 'No learning goal set'}</p>
        </div>
        <nav className="project-nav">
          {navSections.map((item) => (
            <button key={item.key} className={active === item.key ? 'project-nav-item active' : 'project-nav-item'} onClick={() => setActive(item.key)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-spacer" />
        <div className="rail-foot"><span className="pulse" /> Connected to your material</div>
      </aside>

      <section className="project-stage">
        {active === 'overview' && <OverviewPane mastery={mastery} materials={materials} analytics={analytics} onOpen={(key) => setActive(key)} />}
        {active === 'materials' && <MaterialsPane materials={materials} token={token} projectId={projectId} />}
        {active === 'tutor' && <TutorPane {...view} />}
        {active === 'quiz' && <QuizPane {...view} />}
        {active === 'assessment' && <AssessmentPane {...view} />}
        {active === 'mastery' && <MasteryPane concepts={concepts} mastery={mastery} />}
        {active === 'growth' && <GrowthPane {...view} />}
        {active === 'analytics' && <AnalyticsDashboard analytics={analytics} />}
      </section>
    </div>
  )
}

function OverviewPane({ mastery, materials, analytics, onOpen }) {
  const stats = [
    { label: 'Σ Materials', value: (materials?.length ?? 0), detail: 'sources grounding your tutor' },
    { label: 'Mastered concepts', value: mastery.masteredConceptNames?.length ?? 0, detail: `${mastery.trackedConcepts ?? 0} tracked so far` },
    { label: 'Quiz accuracy', value: `${analytics?.quiz?.accuracy ?? 0}%`, detail: `${analytics?.quiz?.attempts ?? 0} attempts` },
    { label: 'Attention', value: mastery.conceptsNeedingAttentionNames?.length ?? 0, detail: 'concepts to revisit' },
  ]
  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Overview</span><h1>Where things stand</h1><p className="lede">A quick pulse across your project before you dive in.</p></div></div>
      <div className="analytics-stat-grid">
        {stats.map((stat) => (
          <div className="analytics-stat" key={stat.label}><span className="section-label">{stat.label}</span><strong>{stat.value}</strong><p>{stat.detail}</p></div>
        ))}
      </div>
      <div className="analytics-chart-grid" style={{ marginTop: 14 }}>
        <div className="analytics-chart-panel"><span className="section-label">Next step</span><div className="feature-panel" style={{ margin: '14px 0 0' }}><span className="section-label">Keep practising</span><h2>Pin the concepts you missed.</h2><p>Quizzes here adapt to whatever is weakest.</p><button className="text-action" onClick={() => onOpen('quiz')}>Start a quiz →</button></div></div>
        <div className="analytics-chart-panel"><span className="section-label">Recent sources</span>{(materials ?? []).slice(0, 4).map((material) => (
          <div className="analytics-progress-row" key={material._id}><span>📄 {material.title}</span><strong>{material.processingStatus}</strong></div>
        ))}</div>
      </div>
    </div>
  )
}

function MaterialsPane({ materials, token, projectId }) {
  const [dropping, setDropping] = useState(false)
  const [status, setStatus] = useState(null)
  const inputRef = useRef(null)

  async function uploadFile(file) {
    if (!file || !projectId || !token) { setStatus('sample'); return }
    const form = new FormData()
    form.append('file', file)
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const response = await fetch(`${BASE}/api/projects/${projectId}/materials`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(30000) })
      if (response.ok) { setStatus('ok'); window.location.reload() }
      else setStatus('failed')
    } catch { setStatus('failed') }
  }

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Materials</span><h1>Grounding for your tutor</h1><p className="lede">Drop PDFs here and they become the evidence your tutor cites.</p></div></div>
      <div
        className={dropping ? 'drop-zone active' : 'drop-zone'}
        onDragOver={(e) => { e.preventDefault(); setDropping(true) }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => { e.preventDefault(); setDropping(false); uploadFile(e.dataTransfer.files?.[0]) }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => uploadFile(e.target.files?.[0])} />
        <span className="drop-icon">⤓</span>
        <p><strong>Drop a PDF</strong> or click to browse</p>
        {status === 'sample' && <small>Design preview — uploads available once signed in</small>}
        {status === 'ok' && <small className="ok">Uploaded — processing started ✓</small>}
        {status === 'failed' && <small className="bad">Upload failed — is the API running?</small>}
      </div>
      <div className="section-heading" style={{ marginTop: 38 }}><div><span className="section-label">Library</span><h2>All sources</h2></div><span className="mono-label">{materials?.length ?? 0} files</span></div>
      <div className="material-list">
        {(materials ?? []).map((material) => (
          <div className="material-row" key={material._id}>
            <span className="material-file">📄 {material.title}</span>
            <span className={`status-chip ${statusTone[material.processingStatus] ?? 'wait'}`}>{material.processingStatus}</span>
            <small>{material.metadata?.chunkCount ?? 0} chunks · {String(material.createdAt).slice(0, 10)}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

const sampleThread = [
  { role: 'user', text: 'Explain polymorphism' },
  { role: 'ai', text: 'Polymorphism means “many forms” — one interface, several implementations. In Java it usually shows up as method overriding (runtime) or overloading (compile time).', citations: [{ title: 'OOP.pdf', page: 23 }] },
]

function TutorPane({ project, token }) {
  const projectId = project.id ?? project._id
  const [thread, setThread] = useState(sampleThread)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread, busy])

  async function ask(text) {
    const question = text?.trim()
    if (!question || busy) return
    setThread((t) => [...t, { role: 'user', text: question }])
    setDraft('')
    setBusy(true)
    setError(null)
    if (!projectId || !token) {
      setTimeout(() => {
        setThread((t) => [...t, { role: 'ai', text: 'Polymorphism appears wherever one reference type works with many concrete objects. Trying it with a real example is the fastest way to make it stick.', citations: [{ title: 'OOP.pdf', page: 23 }] }])
        setBusy(false)
      }, 650)
      return
    }
    try {
      const result = await post(`/api/projects/${projectId}/tutor/ask`, { question }, token)
      const citations = (result.citations ?? []).map((citation) => ({ title: citation.title ?? citation.materialTitle ?? 'Source', page: citation.page ?? citation.pageNumber }))
      setThread((t) => [...t, { role: 'ai', text: result.answer, refused: result.refused, citations }])
    } catch {
      setError('The tutor could not be reached. Check that the API is running.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stage-inner chat-stage">
      <div className="stage-heading"><div><span className="section-label">AI tutor</span><h1>Ask the project</h1><p className="lede">Answers are grounded in your materials and cited back to the page.</p></div></div>
      <div className="chat-window">
        {thread.map((message, index) => (
          <div key={index} className={message.role === 'ai' ? 'chat-bubble ai' : 'chat-bubble user'}>
            <span className="chat-role">{message.role === 'ai' ? 'AI' : 'You'}</span>
            <p>{message.text}</p>
            {message.refused && <small className="refusal">Not in your material — I won't guess.</small>}
            {message.citations?.length > 0 && (
              <div className="chat-citations">📚 {message.citations.map((citation, i) => <span key={i}>{citation.title} — Page {citation.page}</span>)}</div>
            )}
          </div>
        ))}
        {busy && <div className="chat-bubble ai"><span className="chat-role">AI</span><p className="typing">Thinking…</p></div>}
        {error && <p className="chat-status-failed">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(draft) }}
          placeholder="Ask another question…"
          disabled={busy}
        />
        <button onClick={() => ask(draft)} disabled={busy || !draft.trim()}>Ask <span>→</span></button>
      </div>
    </div>
  )
}

function QuizPane({ project, token }) {
  const projectId = project.id ?? project._id
  const [quiz, setQuiz] = useState(null)
  const [picks, setPicks] = useState({})
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(true)

  async function newQuiz() {
    setBusy(true)
    setPicks({})
    if (!projectId || !token) {
      setTimeout(() => { setQuiz(sampleQuiz); setBusy(false) }, 500)
      return
    }
    try {
      const result = await post(`/api/projects/${projectId}/quizzes`, { count: 3 }, token)
      setQuiz(result.quiz)
    } catch {
      setQuiz(sampleQuiz)
    } finally {
      setBusy(false)
    }
  }

  const answered = Object.keys(picks).length === (quiz?.questions?.length ?? 0)

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Quiz</span><h1>Adaptive practice</h1><p className="lede">Each question targets your weakest concepts first.</p></div><button className="primary-action" onClick={newQuiz} disabled={busy}>{busy ? 'Generating…' : 'New quiz'} <span>→</span></button></div>
      {!quiz ? (
        <div className="analytics-empty quiz-empty">Generate a quiz to start — it adapts to your mastery.</div>
      ) : (
        <div className="quiz-list">
          {quiz.questions.map((question, index) => (
            <div className="quiz-card" key={question._id ?? index}>
              <div className="quiz-card-head"><span className="module-number">Q{String(index + 1).padStart(2, '0')}</span><span className="section-label">{question.concept ?? 'Adaptive'}</span></div>
              <h2>{question.prompt}</h2>
              <div className="quiz-options">
                {question.options.map((option) => (
                  <button key={option} className={picks[question._id ?? index] === option ? 'quiz-option selected' : 'quiz-option'} onClick={() => setPicks((p) => ({ ...p, [question._id ?? index]: option }))}>{option}</button>
                ))}
              </div>
            </div>
          ))}
          {answered && (
            <div className="quiz-submit-bar"><span>All questions answered.</span><button className="primary-action" onClick={() => setQuiz(null)}>Submit <span>→</span></button></div>
          )}
        </div>
      )}
    </div>
  )
}

function AssessmentPane() {
  const [open, setOpen] = useState(false)
  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Assessment</span><h1>Show it, don't say it</h1><p className="lede">A written prompt that asks you to reason out loud — graded against your own material.</p></div></div>
      <div className="assessment-card">
        <span className="section-label">Open-ended prompt</span>
        <h2>Explain how polymorphism lets one piece of code handle many concrete types. Cite the examples from your notes.</h2>
        <textarea placeholder={open ? 'Write your answer here…' : 'Click Start to begin the timed assessment.'} readOnly={!open} />
        <div className="assessment-actions">
          {!open ? <button className="primary-action" onClick={() => setOpen(true)}>Start assessment <span>→</span></button> : <button className="secondary-action" onClick={() => setOpen(false)}>Finish & submit</button>}
        </div>
      </div>
    </div>
  )
}

function MasteryPane({ concepts, mastery }) {
  const rows = concepts.map((concept) => ({ ...concept, warm: (concept.masteryPercent ?? 0) < 60 }))
  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Mastery</span><h1>Understanding, measured</h1><p className="lede">Mastery moves with every quiz, assessment, and conversation.</p></div></div>
      <div className="analytics-stat-grid">
        <div className="analytics-stat"><span className="section-label">Average mastery</span><strong>{mastery.averageMastery ?? 0}%</strong><p>{mastery.trackedConcepts ?? 0} concepts tracked</p></div>
        <div className="analytics-stat"><span className="section-label">Mastered</span><strong>{mastery.masteredConceptNames?.length ?? 0}</strong><p>stable and confident</p></div>
        <div className="analytics-stat"><span className="section-label">Developing</span><strong>{mastery.conceptsNeedingAttentionNames?.length ?? 0}</strong><p>worth revisiting</p></div>
      </div>
      <div className="analytics-chart-panel" style={{ marginTop: 14 }}>
        <span className="section-label">Concept-by-concept</span>
        {rows.map((concept) => (
          <div className="analytics-progress-row" key={concept.concept}>
            <span>{concept.concept}</span>
            <div className={concept.warm ? 'progress-track warm' : 'progress-track'}><i style={{ width: `${concept.masteryPercent}%` }} /></div>
            <strong>{concept.masteryPercent}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function GrowthPane({ project, token }) {
  const projectId = project.id ?? project._id
  const [recommendations, setRecommendations] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const fallback = [
        { type: 'review', concept: 'Interfaces', why: 'Weaker than the rest of your project — revisit with a short quiz.' },
        { type: 'quiz', concept: 'Abstraction', why: 'A focused quiz will sharpen the distinction from encapsulation.' },
        { type: 'deepen', concept: 'Polymorphism', why: 'Confident enough to try coding it without notes.' },
      ]
      if (!projectId || !token) { setRecommendations(fallback); return }
      try {
        const result = await get(`/api/projects/${projectId}/recommendations`, token).catch(() => null)
        if (!alive) return
        setRecommendations(result?.recommendations?.length ? result.recommendations.map((item) => ({ type: item.type, concept: item.concept ?? item.conceptName ?? 'Concept', why: item.why })) : fallback)
      } catch { if (alive) setRecommendations(fallback) }
    }
    load()
    return () => { alive = false }
  }, [projectId, token])

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Growth</span><h1>What to do next</h1><p className="lede">Generated from your latest mastery and activity signals.</p></div></div>
      <div className="growth-list">
        {recommendations?.map((item, index) => (
          <div className="growth-row" key={index}>
            <span className="growth-icon">{item.type === 'review' ? '↻' : item.type === 'quiz' ? '◆' : '✦'}</span>
            <div><span className="section-label">{item.type}</span><h2>{item.concept}</h2><p>{item.why}</p></div>
            <span className="growth-arrow">→</span>
          </div>
        ))}
        {!recommendations && <div className="analytics-empty">Crunching your signals…</div>}
      </div>
    </div>
  )
}