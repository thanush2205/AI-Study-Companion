import { useEffect, useState } from 'react'
import AdminDashboard from './components/AdminDashboard'
import { LoginScreen, RegisterScreen } from './components/AuthScreens'
import ProjectWorkspace from './components/ProjectWorkspace'
import './App.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function get(path, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(15000) })
  if (!response.ok) return null
  return response.json()
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  let json
  try { json = JSON.parse(text) } catch { json = {} }
  return { status: response.status, json }
}

const spaceColors = ['#e36750', '#41a37c', '#d9a441', '#7a9bd4']

function App() {
  const [apiStatus, setApiStatus] = useState('Checking')
  const [token, setToken] = useState(() => window.localStorage.getItem('token'))
  const [user, setUser] = useState(() => JSON.parse(window.localStorage.getItem('user') ?? '{}'))
  const [activeView, setActiveView] = useState(token ? 'dashboard' : 'auth')
  const [authMode, setAuthMode] = useState('login')
  const [selectedSpace, setSelectedSpace] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [spaces, setSpaces] = useState(null)
  const [projects, setProjects] = useState(null)
  const [browseUserId, setBrowseUserId] = useState(null)

  useEffect(() => {
    fetch(`${BASE}/api/health`)
      .then((response) => (response.ok ? setApiStatus('Online') : setApiStatus('Unavailable')))
      .catch(() => setApiStatus('Unavailable'))
  }, [])

  useEffect(() => {
    if (!token) return
    loadSpaces()
  }, [token])

  async function loadSpaces() {
    const json = await get('/api/spaces', token)
    setSpaces(json?.spaces ?? null)
  }

  useEffect(() => {
    if (!token || !selectedSpace?._id) { setProjects(null); return }
    loadProjects()
  }, [token, selectedSpace])

  async function loadProjects() {
    const json = await get(`/api/spaces/${selectedSpace._id}/projects`, token)
    setProjects(json?.projects ?? null)
  }

  const stale = user?.name?.slice(0, 2)?.toUpperCase() ?? 'SC'
  const isAdmin = user?.role === 'ADMIN'

  function signOut() {
    window.localStorage.removeItem('token')
    window.localStorage.removeItem('user')
    setToken(null); setUser({})
    setActiveView('auth'); setAuthMode('login')
    setSelectedSpace(null); setSelectedProject(null)
    setSpaces(null); setProjects(null)
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand-mark"><span>SC</span> Study Companion</div>
        <div className="topbar-actions">
          <div className="environment"><span className="status-dot" /> API <strong>{apiStatus}</strong></div>
          {token ? (
            <button className="avatar" title="Sign out" onClick={signOut}>{stale}</button>
          ) : (
            <button className="secondary-action" onClick={() => { setActiveView('auth'); setAuthMode('login') }}>Sign in</button>
          )}
        </div>
      </nav>

      {activeView === 'auth' ? (
        <div className="auth-shell">
          {authMode === 'login'
            ? <LoginScreen onAuthed={(authedUser, authedToken) => { setUser(authedUser); setToken(authedToken); setActiveView('dashboard') }} />
            : <RegisterScreen onAuthed={(authedUser, authedToken) => { setUser(authedUser); setToken(authedToken); setActiveView('dashboard') }} />}
          <button className="text-action auth-mode-switch" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Need an account? Create one' : 'Have an account? Sign in'}
          </button>
        </div>
      ) : (
        <div className="workspace-layout">
          <aside className="sidebar">
            <p className="section-label">Your learning system</p>
            <button className={activeView === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('dashboard')}>⌂ <span>Dashboard</span></button>
            <button className={activeView === 'spaces' || activeView === 'space-detail' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('spaces'); setSelectedProject(null) }}>▦ <span>Spaces</span></button>
            {isAdmin && <button className={activeView === 'admin' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('admin'); setBrowseUserId(null) }}>⊕ <span>Admin</span></button>}
            <div className="sidebar-rule" />
            <p className="sidebar-note">Each space holds the projects, materials, and progress that belong together.</p>
            <div className="sidebar-spacer" />
            {token && <button className="nav-item" onClick={signOut}>↩ <span>Sign out</span></button>}
          </aside>
          <section className="workspace-content">
            <div className="breadcrumbs">
              <button onClick={() => { setActiveView('dashboard'); setSelectedSpace(null); setSelectedProject(null) }}>Dashboard</button><span>/</span>
              <button onClick={() => { setActiveView('spaces'); setSelectedProject(null) }}>Spaces</button>
              {selectedSpace && <><span>/</span><button onClick={() => setActiveView('space-detail')}>{selectedSpace.name}</button></>}
              {selectedProject && <><span>/</span><strong>{selectedProject.title}</strong></>}
            </div>

            {activeView === 'dashboard' && <Dashboard user={user} spaces={spaces} onSpaces={() => { setActiveView('spaces'); setSelectedProject(null) }} />}
            {activeView === 'spaces' && <Spaces spaces={spaces} onSelect={(space) => { setSelectedSpace(space); setActiveView('space-detail'); setSelectedProject(null) }} onCreated={loadSpaces} token={token} />}
            {activeView === 'space-detail' && selectedSpace && <SpaceDetail token={token} space={selectedSpace} projects={projects} onSelectProject={(project) => { setSelectedProject(project); setActiveView('project') }} onCreated={loadProjects} />}
            {activeView === 'project' && selectedProject && <ProjectWorkspace project={selectedProject} token={token} />}
            {activeView === 'admin' && isAdmin && <AdminDashboard user={user} />}
          </section>
        </div>
      )}

      <footer><span>v0.3 polished workspace</span><span>Modular monolith · local first</span></footer>
    </main>
  )
}

function Dashboard({ user, onSpaces, spaces }) {
  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const spaceCount = Array.isArray(spaces) ? spaces.length : 0
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">{greeting}, {firstName}</p><h1>Your learning, <em>in motion.</em></h1><p className="lede">Choose a space to pick up where you left off.</p></div>
        <button className="primary-action" onClick={onSpaces}>Explore spaces <span>→</span></button>
      </div>
      <div className="dashboard-grid">
        <div className="feature-panel"><span className="section-label">Next up</span><h2>{spaceCount ? 'Open a space to keep going.' : 'Build your first learning space'}</h2><p>{spaceCount ? 'Everything — materials, tutor sessions, quizzes, and mastery — lives inside a space.' : 'Group related projects together so every conversation, quiz, and insight has a clear home.'}</p><button className="text-action" onClick={onSpaces}>View spaces →</button></div>
        <div className="metric-panel"><span className="section-label">Your spaces</span><strong>{spaceCount}</strong><p>{spaceCount === 1 ? 'learning space' : 'learning spaces'}</p><button className="text-action" onClick={onSpaces}>Manage spaces →</button></div>
      </div>
    </>
  )
}

function Spaces({ spaces, onSelect, onCreated, token }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(spaceColors[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function createSpace(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { status, json } = await post('/api/spaces', { name: name.trim(), description: description.trim(), color }, token)
    setBusy(false)
    if (status === 201 && json.space) {
      setName(''); setDescription(''); setColor(spaceColors[0]); setShowForm(false)
      onCreated()
    } else {
      setError(json.error ?? 'Could not create the space.')
    }
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">Your spaces</p><h1>Make room for <em>curiosity.</em></h1></div>
        <button className="primary-action" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New space'} <span>{showForm ? '×' : '+'}</span></button>
      </div>
      {showForm && (
        <form className="auth-card" style={{ marginBottom: 26 }} onSubmit={createSpace}>
          <span className="section-label">Create a space</span>
          <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Computer Science" required /></label>
          <label>Description<input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What lives in this space?" /></label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-action" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create space'} <span>→</span></button>
        </form>
      )}
      {spaces === null ? (
        <p className="insight-empty">Loading your spaces…</p>
      ) : spaces.length === 0 ? (
        <p className="insight-empty">No spaces yet — create your first one to start learning.</p>
      ) : (
        <div className="space-grid">{spaces.map((space) => {
          const colorKey = `${space._id}${space.name}`.length
          return (
            <button className="space-card" key={space._id} onClick={() => onSelect(space)}>
              <span className="space-color" style={{ background: space.color ?? spaceColors[colorKey % 4] }} /><div><h2>{space.name}</h2><p>{space.description ?? 'A home for related projects.'}</p><small>{space.projectCount ?? 0} projects <span>→</span></small></div>
            </button>
          )
        })}</div>
      )}
    </>
  )
}

function SpaceDetail({ token, space, projects, onSelectProject, onCreated }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [learningGoal, setLearningGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function createProject(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { status, json } = await post(`/api/spaces/${space._id}/projects`, { title: title.trim(), description: description.trim(), learningGoal: learningGoal.trim() }, token)
    setBusy(false)
    if (status === 201 && json.project) {
      setTitle(''); setDescription(''); setLearningGoal(''); setShowForm(false)
      onCreated()
    } else {
      setError(json.error ?? 'Could not create the project.')
    }
  }

  return (
    <>
      <div className="space-hero"><span className="space-color large" style={{ background: space.color ?? '#e36750' }} /><p className="eyebrow">Space detail</p><h1>{space.name}</h1><p className="lede">{space.description ?? 'A home for related projects.'}</p></div>
      <div className="section-heading">
        <div><span className="section-label">Projects</span><h2>What are you learning?</h2></div>
        <button className="primary-action" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New project'} <span>{showForm ? '×' : '+'}</span></button>
      </div>
      {showForm && (
        <form className="auth-card" style={{ marginBottom: 26 }} onSubmit={createProject}>
          <span className="section-label">Create a project</span>
          <label>Title<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Operating systems" required /></label>
          <label>Description<input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" /></label>
          <label>Learning goal<input type="text" value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} placeholder="What do you want to be able to do?" /></label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-action" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create project'} <span>→</span></button>
        </form>
      )}
      {projects === null ? (
        <p className="insight-empty">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="insight-empty">No projects yet — create one to start uploading materials.</p>
      ) : (
        <div className="project-list">{projects.map((project) => (
          <button className="project-row" key={project._id} onClick={() => onSelectProject(project)}>
            <div className="project-index">0{projects.indexOf(project) + 1}</div>
            <div><h2>{project.title}</h2><p>{project.description}</p><small>Goal · {project.learningGoal}</small></div>
            <span className="project-arrow">→</span>
          </button>
        ))}</div>
      )}
    </>
  )
}

export default App