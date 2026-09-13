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

export function isLiveProject(projectId, token) {
  return Boolean(token) && /^[0-9a-f]{24}$/i.test(String(projectId ?? ''))
}

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

export default function ProjectWorkspace({ project, token }) {
  const [active, setActive] = useState('tutor')
  const [materials, setMaterials] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [tutorSuggestion, setTutorSuggestion] = useState(null)
  const projectId = project.id ?? project._id
  const mounted = useRef(true)

  const loadData = () => {
    setMaterials(null)
    setAnalytics(null)
    if (!isLiveProject(projectId, token)) {
      setMaterials([])
      return
    }
    Promise.all([
      get(`/api/projects/${projectId}/materials`, token).catch(() => null),
      get(`/api/projects/${projectId}/analytics`, token).catch(() => null),
      get(`/api/projects/${projectId}/growth`, token).catch(() => null),
    ]).then(([materialData, analyticsData, growthData]) => {
      if (!mounted.current) return
      setMaterials(materialData?.materials ?? [])
      const trend = (growthData?.growth ?? []).map((row) => ({ week: row.week ?? 'Week', masteryPercent: row.masteryPercent ?? 0 }))
      setAnalytics(analyticsData?.analytics
        ? { ...analyticsData.analytics, masteryTrend: trend.length ? trend : (analyticsData.analytics.masteryTrend ?? []) }
        : null)
    }).catch(() => {
      if (mounted.current) { setMaterials([]); setAnalytics(null) }
    })
  }

  useEffect(() => {
    mounted.current = true
    loadData()
    return () => { mounted.current = false }
  }, [projectId, token])

  const handleNavigate = (key, options = {}) => {
    if (options.prompt) setTutorSuggestion({ nonce: Date.now(), prompt: options.prompt })
    setActive(key)
  }

  const view = { project, token }
  const mastery = analytics?.mastery ?? {}

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
        {active === 'materials' && <MaterialsPane materials={materials} token={token} projectId={projectId} onChanged={loadData} />}
        {active === 'tutor' && <TutorPane {...view} suggestion={tutorSuggestion} />}
        {active === 'quiz' && <QuizPane {...view} />}
        {active === 'assessment' && <AssessmentPane {...view} />}
        {active === 'mastery' && <MasteryPane analytics={analytics} projectId={projectId} token={token} onNavigate={handleNavigate} />}
        {active === 'growth' && <GrowthPane {...view} />}
        {active === 'analytics' && <AnalyticsDashboard analytics={analytics} />}
      </section>
    </div>
  )
}

function OverviewPane({ mastery, materials, analytics, onOpen }) {
  const stats = [
    { label: 'Σ Materials', value: (materials?.length ?? 0), detail: 'sources grounding your tutor' },
    { label: 'Mastered concepts', value: mastery.masteredConcepts?.length ?? 0, detail: `${mastery.trackedConcepts ?? 0} tracked so far` },
    { label: 'Quiz accuracy', value: `${analytics?.quiz?.accuracy ?? 0}%`, detail: `${analytics?.quiz?.attempts ?? 0} attempts` },
    { label: 'Attention', value: mastery.conceptsNeedingAttention?.length ?? 0, detail: 'concepts to revisit' },
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
        <div className="analytics-chart-panel"><span className="section-label">Recent sources</span>{(materials ?? []).length ? (materials ?? []).slice(0, 4).map((material) => (
          <div className="analytics-progress-row" key={material._id}><span>📄 {material.title}</span><strong>{material.processingStatus}</strong></div>
        )) : <div className="analytics-empty">No materials yet — upload a PDF to get started.</div>}</div>
      </div>
    </div>
  )
}

function MaterialsPane({ materials, token, projectId, onChanged }) {
  const [dropping, setDropping] = useState(false)
  const [status, setStatus] = useState(null)
  const inputRef = useRef(null)

  async function uploadFile(file) {
    if (!file || !isLiveProject(projectId, token)) return
    const form = new FormData()
    form.append('file', file)
    const headers = { Authorization: `Bearer ${token}` }
    setStatus('uploading')
    try {
      const response = await fetch(`${BASE}/api/projects/${projectId}/materials`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(30000) })
      if (!response.ok) setStatus('failed')
      else { setStatus('ok'); onChanged() }
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
        {status === 'uploading' && <small>Uploading…</small>}
        {status === 'ok' && <small className="ok">Uploaded — processing started ✓</small>}
        {status === 'failed' && <small className="bad">Upload failed — is the API running?</small>}
      </div>
      <div className="section-heading" style={{ marginTop: 38 }}><div><span className="section-label">Library</span><h2>All sources</h2></div><span className="mono-label">{materials?.length ?? 0} files</span></div>
      {materials === null ? (
        <p className="insight-empty">Loading your materials…</p>
      ) : (materials ?? []).length === 0 ? (
        <p className="insight-empty">Nothing uploaded yet — every answer the tutor gives is grounded in a PDF you add here.</p>
      ) : (
        <div className="material-list">
          {(materials ?? []).map((material) => (
            <div className="material-row" key={material._id}>
              <span className="material-file">📄 {material.title}</span>
              <span className={`status-chip ${statusTone[material.processingStatus] ?? 'wait'}`}>{material.processingStatus}</span>
              <small>{material.metadata?.chunkCount ?? 0} chunks · {String(material.createdAt).slice(0, 10)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TutorPane({ project, token, suggestion }) {
  const projectId = project.id ?? project._id
  const [thread, setThread] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread, busy])

  useEffect(() => {
    if (!isLiveProject(projectId, token)) { setLoaded(true); return }
    let alive = true
    get(`/api/projects/${projectId}/conversations`, token)
      .then(async (json) => {
        if (!alive) return
        const latest = json?.conversations?.[0]
        if (!latest) { setLoaded(true); return }
        const msgs = await get(`/api/conversations/${latest._id}`, token).catch(() => null)
        if (!alive) return
        const history = (msgs?.messages ?? []).map((message) => ({
          role: message.role === 'user' ? 'user' : 'ai',
          text: message.content,
          refused: message.metadata?.grounded === false,
          citations: (message.citations ?? []).map((citation) => ({ title: 'Your material', page: citation.pageNumber ?? 'unknown' })),
        }))
        setThread(history)
        setConversationId(latest._id)
        setLoaded(true)
      })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [projectId, token])

  useEffect(() => {
    if (suggestion?.prompt && !busy) setDraft(suggestion.prompt)
  }, [suggestion?.nonce])

  async function ask(text) {
    const question = text?.trim()
    if (!question || busy) return
    setThread((t) => [...t, { role: 'user', text: question }])
    setDraft('')
    setBusy(true)
    setError(null)
    try {
      const result = await post(`/api/projects/${projectId}/tutor/ask`, { question, conversationId }, token)
      if (result.conversationId) setConversationId(result.conversationId)
      const citations = (result.citations ?? []).map((citation) => ({ title: citation.materialTitle ?? citation.material ?? 'Source', page: citation.pageNumber ?? citation.page ?? 'unknown' }))
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
        {loaded && thread.length === 0 && <p className="insight-empty">Ask a question about your material — the tutor answers only from evidence in your PDFs.</p>}
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
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busySubmit, setBusySubmit] = useState(false)
  const [error, setError] = useState(null)

  async function newQuiz() {
    setBusy(true)
    setError(null)
    setPicks({})
    setResult(null)
    setQuiz(null)
    try {
      const result = await post(`/api/projects/${projectId}/quizzes`, { count: 3 }, token)
      setQuiz(result.quiz)
    } catch {
      setError('Could not generate a quiz — upload a material and let it finish processing first.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!quiz || busySubmit) return
    setBusySubmit(true)
    setError(null)
    try {
      const answers = quiz.questions.map((question) => ({ questionId: question._id, answer: picks[question._id] }))
      const attempt = await post(`/api/quizzes/${quiz._id}/attempts`, { answers }, token)
      setResult(attempt)
    } catch {
      setError('Could not submit the quiz — check that the API is running.')
    } finally {
      setBusySubmit(false)
    }
  }

  const answered = Object.keys(picks).length === (quiz?.questions?.length ?? 0)

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Quiz</span><h1>Adaptive practice</h1><p className="lede">Each question targets your weakest concepts first.</p></div><button className="primary-action" onClick={newQuiz} disabled={busy}>{busy ? 'Generating…' : 'New quiz'} <span>→</span></button></div>
      {error && <p className="insight-error">{error}</p>}
      {!quiz ? (
        <div className="analytics-empty quiz-empty">Generate a quiz to start — it adapts to your mastery.</div>
      ) : result ? (
        <div className="quiz-list">
          <div className="insight-card">
            <div className="insight-head"><span className="section-label">Result</span><span className="insight-grounded">● {Math.round(result.score * 100)}%</span></div>
            <p className="insight-summary">{result.feedback}</p>
          </div>
          {quiz.questions.map((question, index) => {
            const item = result.answers?.find((answer) => String(answer.questionId) === String(question._id)) ?? {}
            return (
              <div className="quiz-card" key={question._id}>
                <div className="quiz-card-head"><span className="module-number">Q{String(index + 1).padStart(2, '0')}</span><span className="section-label">{item.correct ? 'Correct' : 'Missed'}</span></div>
                <h2>{question.prompt}</h2>
                <div className="quiz-options">
                  {question.options.map((option) => {
                    const isAnswer = option === item.answer
                    const isCorrect = item.correct && isAnswer
                    const isMiss = !item.correct && isAnswer
                    return <button key={option} className={`quiz-option${isCorrect ? ' ok' : ''}${isMiss ? ' wrong' : ''}`}>{option}</button>
                  })}
                </div>
                {item.explanation && <p className="insight-empty" style={{ marginTop: 12 }}>{item.explanation}</p>}
              </div>
            )
          })}
          <div className="quiz-submit-bar"><span>Score recorded — mastery updated.</span><button className="primary-action" onClick={newQuiz}>New quiz <span>→</span></button></div>
        </div>
      ) : (
        <div className="quiz-list">
          {quiz.questions.map((question, index) => (
            <div className="quiz-card" key={question._id}>
              <div className="quiz-card-head"><span className="module-number">Q{String(index + 1).padStart(2, '0')}</span><span className="section-label">Adaptive</span></div>
              <h2>{question.prompt}</h2>
              <div className="quiz-options">
                {question.options.map((option) => (
                  <button key={option} className={picks[question._id] === option ? 'quiz-option selected' : 'quiz-option'} onClick={() => setPicks((p) => ({ ...p, [question._id]: option }))}>{option}</button>
                ))}
              </div>
            </div>
          ))}
          {answered && (
            <div className="quiz-submit-bar"><span>All questions answered.</span><button className="primary-action" onClick={submit} disabled={busySubmit}>{busySubmit ? 'Submitting…' : 'Submit'} <span>→</span></button></div>
          )}
        </div>
      )}
    </div>
  )
}

function AssessmentPane({ project, token }) {
  const projectId = project.id ?? project._id
  const [concepts, setConcepts] = useState(null)
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    if (!isLiveProject(projectId, token)) { setConcepts([]); return }
    get(`/api/projects/${projectId}/concepts`, token)
      .then((json) => { if (alive) setConcepts(json?.concepts ?? []) })
      .catch(() => { if (alive) setConcepts([]) })
    return () => { alive = false }
  }, [projectId, token])

  async function submit(e) {
    e.preventDefault()
    if (!selected || !draft.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const evaluation = await post(`/api/projects/${projectId}/assessments`, {
        conceptId: selected._id,
        question: `Explain "${selected.name}" in your own words, using the learning materials.`,
        answer: draft.trim(),
      }, token)
      setResult({ evaluation, concept: selected })
    } catch {
      setError('Assessment failed — check that the concept has material to grade against.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setSelected(null); setDraft(''); setResult(null); setError(null)
  }

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Assessment</span><h1>Show it, don't say it</h1><p className="lede">A written prompt that asks you to reason out loud — graded against your own material.</p></div></div>
      {concepts === null ? (
        <p className="insight-empty">Loading concepts…</p>
      ) : result ? (
        <div className="assessment-card">
          <span className="section-label">Evaluation — {result.concept.name}</span>
          <h2>{result.evaluation.feedback}</h2>
          <div className="insight-pattern"><span>Score</span><strong>{result.evaluation.score ?? 0}%</strong></div>
          {result.evaluation.masteryImpact != null && <p className="insight-summary">Mastery shifted {Math.round(result.evaluation.masteryImpact * 100)}% this round.</p>}
          {result.evaluation.correctPoints?.length > 0 && (
            <>
              <span className="section-label">What you got right</span>
              <ul className="insight-reasons" style={{ marginBottom: 6 }}>{result.evaluation.correctPoints.map((point, i) => <li key={i}>{point}</li>)}</ul>
            </>
          )}
          {result.evaluation.missingPoints?.length > 0 && (
            <>
              <span className="section-label">What was missing</span>
              <ul className="insight-reasons" style={{ marginBottom: 6 }}>{result.evaluation.missingPoints.map((point, i) => <li key={i}>{point}</li>)}</ul>
            </>
          )}
          {result.evaluation.misconceptions?.length > 0 && (
            <>
              <span className="section-label">Misconceptions</span>
              <ul className="insight-reasons">{result.evaluation.misconceptions.map((misconception, i) => <li key={i}>{misconception}</li>)}</ul>
            </>
          )}
          <div className="assessment-actions">
            <button className="primary-action" onClick={reset}>Try another concept <span>→</span></button>
          </div>
        </div>
      ) : !selected ? (
        concepts.length === 0 ? (
          <div className="analytics-empty quiz-empty">No concepts to assess yet — upload a PDF and let it finish processing first.</div>
        ) : (
          <>
            <div className="section-heading"><div><span className="section-label">Concepts</span><h2>Pick what to explain</h2></div><span className="mono-label">{concepts.length} concepts</span></div>
            <div className="project-list">
              {concepts.map((concept, index) => (
                <button className="project-row" key={concept._id} onClick={() => setSelected(concept)}>
                  <div className="project-index">0{index + 1}</div>
                  <div><h2>{concept.name}</h2><p>{concept.description}</p><small>{concept.sourceChunkIds?.length ?? 0} source chunks</small></div>
                  <span className="project-arrow">→</span>
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <form className="assessment-card" onSubmit={submit}>
          <span className="section-label">Open-ended prompt</span>
          <h2>Explain "{selected.name}" in your own words. Cite the examples from your notes.</h2>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write your answer here — be specific and reference the material…" disabled={busy} />
          {error && <p className="auth-error">{error}</p>}
          <div className="assessment-actions">
            <button type="button" className="secondary-action" onClick={() => setSelected(null)}>Pick another concept</button>
            <button className="primary-action" disabled={busy || !draft.trim()}>{busy ? 'Grading…' : 'Submit for grading'} <span>→</span></button>
          </div>
        </form>
      )}
    </div>
  )
}

function MasteryPane({ analytics, projectId, token, onNavigate }) {
  const mastery = analytics?.mastery ?? {}
  const [concepts, setConcepts] = useState(null)
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    let alive = true
    if (!isLiveProject(projectId, token)) { setConcepts([]); return }
    get(`/api/projects/${projectId}/concepts`, token)
      .then((json) => { if (alive) setConcepts(json?.concepts ?? []) })
      .catch(() => { if (alive) setConcepts([]) })
    return () => { alive = false }
  }, [projectId, token])

  let rows = []
  if (concepts !== null) {
    rows = concepts.map((concept) => ({
      conceptId: concept._id,
      concept: concept.name,
      masteryPercent: Math.round((concept.mastered?.currentMastery ?? 0) * 100),
    }))
  } else if (analytics) {
    rows = [...(mastery.conceptsNeedingAttention ?? []), ...(mastery.masteredConcepts ?? [])]
      .map((row) => ({ conceptId: row.conceptId, concept: row.concept, masteryPercent: row.masteryPercent }))
  }
  rows = rows.sort((a, b) => a.masteryPercent - b.masteryPercent)

  const requestAnalysis = async (row) => {
    if (!isLiveProject(projectId, token)) return
    setAnalysis((prev) => ({ ...prev, [row.conceptId]: { state: 'analyzing' } }))
    try {
      const response = await fetch(`${BASE}/api/projects/${projectId}/mastery/${row.conceptId}/struggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(45000),
      })
      const json = await response.json()
      if (json.insufficientData) {
        setAnalysis((prev) => ({ ...prev, [row.conceptId]: { state: 'empty', reason: json.reason } }))
      } else {
        setAnalysis((prev) => ({ ...prev, [row.conceptId]: { state: 'ready', data: json.insight, source: json.source } }))
      }
    } catch {
      setAnalysis((prev) => ({ ...prev, [row.conceptId]: { state: 'error' } }))
    }
  }

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Mastery</span><h1>Understanding, measured</h1><p className="lede">Mastery moves with every quiz, assessment, and conversation.</p></div></div>
      <div className="analytics-stat-grid">
        <div className="analytics-stat"><span className="section-label">Average mastery</span><strong>{mastery.averageMastery ?? 0}%</strong><p>{mastery.trackedConcepts ?? 0} concepts tracked</p></div>
        <div className="analytics-stat"><span className="section-label">Mastered</span><strong>{mastery.masteredConcepts?.length ?? 0}</strong><p>stable and confident</p></div>
        <div className="analytics-stat"><span className="section-label">Needs attention</span><strong>{mastery.conceptsNeedingAttention?.length ?? 0}</strong><p>worth revisiting</p></div>
      </div>
      <div className="analytics-chart-panel" style={{ marginTop: 14 }}>
        <span className="section-label">Concept-by-concept</span>
        {concepts === null ? (
          <p className="insight-empty">Loading mastery…</p>
        ) : rows.length === 0 ? (
          <p className="insight-empty">No concepts tracked yet — submit a quiz or an assessment to start building mastery.</p>
        ) : rows.map((concept) => {
          const weak = concept.masteryPercent < 60
          const state = analysis?.[concept.conceptId]
          return (
            <div className="mastery-block" key={concept.conceptId}>
              <div className="analytics-progress-row">
                <span>{concept.concept}</span>
                <div className={weak ? 'progress-track warm' : 'progress-track'}><i style={{ width: `${concept.masteryPercent}%` }} /></div>
                <strong>{concept.masteryPercent}%</strong>
              </div>
              {weak && (
                <div className="mastery-actions">
                  {!state?.state && (
                    <button className={state?.state === 'analyzing' ? 'why-button analyzing' : 'why-button'} onClick={() => requestAnalysis(concept)} disabled={state?.state === 'analyzing'}>
                      <span>✦</span> {state?.state === 'analyzing' ? 'Analyzing your answers…' : 'Why am I struggling?'}
                    </button>
                  )}
                  {state?.state === 'ready' && <InsightCard data={state.data} concept={concept} onNavigate={onNavigate} />}
                  {state?.state === 'error' && <p className="insight-error">Couldn't analyze — is the API running?</p>}
                  {state?.state === 'empty' && <p className="insight-empty">{state.reason}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InsightCard({ data, concept, onNavigate }) {
  if (!data) return null
  const runAction = (type, extra) => {
    if (type === 'tutor' && extra?.prompt) onNavigate('tutor', { prompt: extra.prompt })
    else if (type === 'quiz') onNavigate('quiz')
    else if (type === 'review') onNavigate('materials')
  }
  return (
    <div className="insight-card">
      <div className="insight-head"><span className="section-label">Why you're struggling — {concept.concept}</span>{data.grounded && <span className="insight-grounded">● Grounded in your material</span>}</div>
      <p className="insight-summary">{data.summary}</p>
      <div className="insight-pattern"><span>Pattern</span><strong>{data.pattern}</strong></div>
      {data.reasons?.length > 0 && (
        <ul className="insight-reasons">{data.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
      )}
      {data.evidence?.length > 0 && (
        <div className="insight-evidence">
          <span className="section-label">Your last answers</span>
          {data.evidence.map((item, i) => (
            <div className="evidence-row" key={i}><code className={item.correct ? 'ev-ok' : 'ev-bad'}>{sourceLabel(item.source)}</code><p>{item.detail}</p></div>
          ))}
        </div>
      )}
      {data.recommendations?.length > 0 && (
        <div className="insight-actions">
          <span className="section-label">Recommended action</span>
          {data.recommendations.map((item, i) => (
            <button key={i} className="insight-action" onClick={() => runAction(item.type, item)}>
              <span className="action-icon">{item.type === 'review' ? '📄' : item.type === 'tutor' ? '✦' : '◆'}</span>
              <span>{item.action} <em className="action-target">{item.type}</em></span>
              <b>→</b>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function sourceLabel(source) {
  return { quiz: 'quiz', assessment: 'assessment', tutor: 'tutor question' }[source] ?? source
}

function GrowthPane({ project, token }) {
  const projectId = project.id ?? project._id
  const [recommendations, setRecommendations] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!isLiveProject(projectId, token)) { setRecommendations([]); return }
      try {
        const result = await get(`/api/projects/${projectId}/recommendations`, token)
        if (!alive) return
        const items = (result?.recommendations ?? []).map((item) => ({
          type: item.type,
          title: item.title,
          concept: item.concept ?? item.conceptName ?? item.metadata?.concept ?? null,
          why: item.why ?? item.metadata?.why ?? item.description,
        }))
        setRecommendations(items)
      } catch { if (alive) setRecommendations([]) }
    }
    load()
    return () => { alive = false }
  }, [projectId, token])

  return (
    <div className="stage-inner">
      <div className="stage-heading"><div><span className="section-label">Growth</span><h1>What to do next</h1><p className="lede">Generated from your latest mastery and activity signals.</p></div></div>
      <div className="growth-list">
        {recommendations === null ? (
          <div className="analytics-empty">Crunching your signals…</div>
        ) : recommendations.length === 0 ? (
          <div className="analytics-empty">No recommendations yet — answer a few quizzes or assessments and they'll appear here.</div>
        ) : recommendations.map((item, index) => (
          <div className="growth-row" key={index}>
            <span className="growth-icon">{item.type === 'review' ? '↻' : item.type === 'quiz' ? '◆' : '✦'}</span>
            <div><span className="section-label">{item.type}</span><h2>{item.concept ?? item.title ?? 'Next step'}</h2><p>{item.why}</p></div>
            <span className="growth-arrow">→</span>
          </div>
        ))}
      </div>
    </div>
  )
}