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

const sampleSpaces = [
  { _id: 's1', name: 'Computer Science', description: 'Algorithms, systems, and the ideas behind them.', color: '#e36750', projections: 3 },
  { _id: 's2', name: 'Design practice', description: 'A place for visual thinking and product craft.', color: '#41a37c', projections: 2 },
  { _id: 's3', name: 'Personal growth', description: 'Books, notes, and ideas worth returning to.', color: '#d9a441', projections: 1 },
]

const sampleProjects = [
  { _id: 'p1', title: 'Operating systems', description: 'Understand the machinery beneath modern computing.', status: 'active', learningGoal: 'Explain core concepts without memorizing definitions.' },
  { _id: 'p2', title: 'Algorithms, clearly', description: 'Turn complexity into intuition and working code.', status: 'active', learningGoal: 'Choose the right approach for unfamiliar problems.' },
]

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
    get('/api/health', token)
    get('/api/spaces', token).then((json) => { if (json?.spaces) setSpaces(json.spaces) })
  }, [token])

  useEffect(() => {
    if (!token || !selectedSpace?._id) { setProjects(null); return }
    get(`/api/spaces/${selectedSpace._id}/projects`, token).then((json) => { if (json?.projects) setProjects(json.projects) })
  }, [token, selectedSpace])

  const stale = user?.name?.slice(0, 2)?.toUpperCase() ?? 'SC'

  function signOut() {
    window.localStorage.removeItem('token')
    window.localStorage.removeItem('user')
    setToken(null); setUser({})
    setActiveView('auth'); setAuthMode('login')
    setSelectedSpace(null); setSelectedProject(null)
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
            <button className={activeView === 'admin' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('admin'); setBrowseUserId(null) }}>⊕ <span>Admin</span></button>
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

            {activeView === 'dashboard' && <Dashboard user={user} onSpaces={() => { setActiveView('spaces'); setSelectedProject(null) }} />}
            {activeView === 'spaces' && <Spaces spaces={spaces ?? sampleSpaces} onSelect={(space) => { setSelectedSpace(space); setActiveView('space-detail'); setSelectedProject(null) }} />}
            {activeView === 'space-detail' && selectedSpace && <SpaceDetail space={selectedSpace} projects={projects ?? sampleProjects} onSelectProject={(project) => { setSelectedProject(project); setActiveView('project') }} />}
            {activeView === 'project' && selectedProject && <ProjectWorkspace project={selectedProject} token={token} />}
            {activeView === 'admin' && <AdminDashboard />}
          </section>
        </div>
      )}

      <footer><span>v0.3 polished workspace</span><span>Modular monolith · local first</span></footer>
    </main>
  )
}

function Dashboard({ user, onSpaces }) {
  const firstName = user?.name?.split(' ')[0] ?? 'Thanush'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">{greeting}, {firstName}</p><h1>Your learning, <em>in motion.</em></h1><p className="lede">Choose a space to pick up where you left off.</p></div>
        <button className="primary-action" onClick={onSpaces}>Explore spaces <span>→</span></button>
      </div>
      <div className="dashboard-grid">
        <div className="feature-panel"><span className="section-label">Next up</span><h2>Build your first learning space</h2><p>Group related projects together so every conversation, quiz, and insight has a clear home.</p><button className="text-action" onClick={onSpaces}>View spaces →</button></div>
        <div className="metric-panel"><span className="section-label">This week</span><strong>0</strong><p>study sessions</p><div className="metric-line"><span /><span /><span /><span /><span /><span /><span /></div></div>
      </div>
    </>
  )
}

function Spaces({ spaces, onSelect }) {
  return (
    <>
      <div className="page-heading compact"><div><p className="eyebrow">Your spaces</p><h1>Make room for <em>curiosity.</em></h1></div><span className="mono-label">{spaces.length} spaces</span></div>
      <div className="space-grid">{spaces.map((space) => {
        const colorKey = `${space._id}${space.name}`.length
        const color = space.color ?? ['#e36750', '#41a37c', '#d9a441', '#7a9bd4'][colorKey % 4]
        return (
          <button className="space-card" key={space._id} onClick={() => onSelect(space)}>
            <span className="space-color" style={{ background: color }} /><div><h2>{space.name}</h2><p>{space.description ?? 'A home for related projects.'}</p><small>{space.projections ?? space.projectCount ?? 0} projects <span>→</span></small></div>
          </button>
        )
      })}</div>
    </>
  )
}

function SpaceDetail({ space, projects, onSelectProject }) {
  return (
    <>
      <div className="space-hero"><span className="space-color large" style={{ background: space.color ?? '#e36750' }} /><p className="eyebrow">Space detail</p><h1>{space.name}</h1><p className="lede">{space.description ?? 'A home for related projects.'}</p></div>
      <div className="section-heading"><div><span className="section-label">Projects</span><h2>What are you learning?</h2></div><span className="mono-label">{projects.length} projects</span></div>
      <div className="project-list">{projects.map((project) => (
        <button className="project-row" key={project._id} onClick={() => onSelectProject(project)}>
          <div className="project-index">0{projects.indexOf(project) + 1}</div>
          <div><h2>{project.title}</h2><p>{project.description}</p><small>Goal · {project.learningGoal}</small></div>
          <span className="project-arrow">→</span>
        </button>
      ))}</div>
    </>
  )
}

export default App