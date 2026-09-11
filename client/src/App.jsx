import { useEffect, useState } from 'react'
import './App.css'

const checks = [
  { label: 'Client shell', detail: 'React + Vite', status: 'Online' },
  { label: 'API contract', detail: 'Express REST boundary', status: 'Ready' },
  { label: 'Knowledge layer', detail: 'MongoDB + Redis hooks', status: 'Pending' },
  { label: 'AI layer', detail: 'Provider adapters', status: 'Pending' },
]

function App() {
  const [apiStatus, setApiStatus] = useState('Checking')
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedSpace, setSelectedSpace] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/health`)
      .then((response) => (response.ok ? setApiStatus('Online') : setApiStatus('Unavailable')))
      .catch(() => setApiStatus('Unavailable'))
  }, [])

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand-mark"><span>SC</span> Study Companion</div>
        <div className="topbar-actions"><div className="environment"><span className="status-dot" /> API <strong>{apiStatus}</strong></div><button className="avatar" aria-label="Open account">TH</button></div>
      </nav>
      <div className="workspace-layout">
        <aside className="sidebar">
          <p className="section-label">Your learning system</p>
          <button className={activeView === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('dashboard')}>⌂ <span>Dashboard</span></button>
          <button className={activeView === 'spaces' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('spaces')}>▦ <span>Spaces</span></button>
          <div className="sidebar-rule" />
          <p className="sidebar-note">Keep your subjects separate. Each space holds the projects, materials, and progress that belong together.</p>
        </aside>
        <section className="workspace-content">
          <div className="breadcrumbs"><button onClick={() => { setActiveView('dashboard'); setSelectedSpace(null); setSelectedProject(null) }}>Dashboard</button><span>/</span><button onClick={() => { setActiveView('spaces'); setSelectedProject(null) }}>Spaces</button>{selectedSpace && <><span>/</span><button onClick={() => setActiveView('space-detail')}>{selectedSpace.name}</button></>}{selectedProject && <><span>/</span><strong>{selectedProject.title}</strong></>}</div>
          {activeView === 'dashboard' && <Dashboard onSpaces={() => setActiveView('spaces')} />}
          {activeView === 'spaces' && <Spaces onSelect={(space) => { setSelectedSpace(space); setActiveView('space-detail') }} />}
          {activeView === 'space-detail' && selectedSpace && <SpaceDetail space={selectedSpace} onSelectProject={(project) => { setSelectedProject(project); setActiveView('project') }} />}
          {activeView === 'project' && selectedProject && <ProjectWorkspace project={selectedProject} />}
        </section>
      </div>
      <footer><span>v0.2 spaces + projects</span><span>Modular monolith · local first</span></footer>
    </main>
  )
}

function Dashboard({ onSpaces }) { return <><div className="page-heading"><div><p className="eyebrow">Good morning, Thanush</p><h1>Your learning, <em>in motion.</em></h1><p className="lede">Choose a space to pick up where you left off.</p></div><button className="primary-action" onClick={onSpaces}>Explore spaces <span>→</span></button></div><div className="dashboard-grid"><div className="feature-panel"><span className="section-label">Next up</span><h2>Build your first learning space</h2><p>Group related projects together so every conversation, quiz, and insight has a clear home.</p><button className="text-action" onClick={onSpaces}>View spaces →</button></div><div className="metric-panel"><span className="section-label">This week</span><strong>0</strong><p>study sessions</p><div className="metric-line"><span /><span /><span /><span /><span /><span /><span /></div></div></div></> }

function Spaces({ onSelect }) { const spaces = [{ name: 'Computer Science', description: 'Algorithms, systems, and the ideas behind them.', color: '#e36750', projects: 3 }, { name: 'Design practice', description: 'A place for visual thinking and product craft.', color: '#41a37c', projects: 2 }, { name: 'Personal growth', description: 'Books, notes, and ideas worth returning to.', color: '#d9a441', projects: 1 }]; return <><div className="page-heading compact"><div><p className="eyebrow">Your spaces</p><h1>Make room for <em>curiosity.</em></h1></div><button className="primary-action">+ New space</button></div><div className="space-grid">{spaces.map((space) => <button className="space-card" key={space.name} onClick={() => onSelect(space)}><span className="space-color" style={{ background: space.color }} /><div><h2>{space.name}</h2><p>{space.description}</p><small>{space.projects} projects <span>→</span></small></div></button>)}</div></> }

function SpaceDetail({ space, onSelectProject }) { const projects = [{ title: 'Operating systems', description: 'Understand the machinery beneath modern computing.', status: 'active', learningGoal: 'Explain core concepts without memorizing definitions.' }, { title: 'Algorithms, clearly', description: 'Turn complexity into intuition and working code.', status: 'active', learningGoal: 'Choose the right approach for unfamiliar problems.' }]; return <><div className="space-hero"><span className="space-color large" style={{ background: space.color }} /><p className="eyebrow">Space detail</p><h1>{space.name}</h1><p className="lede">{space.description}</p></div><div className="section-heading"><div><span className="section-label">Projects</span><h2>What are you learning?</h2></div><button className="secondary-action">+ New project</button></div><div className="project-list">{projects.map((project) => <button className="project-row" key={project.title} onClick={() => onSelectProject(project)}><div className="project-index">0{projects.indexOf(project) + 1}</div><div><h2>{project.title}</h2><p>{project.description}</p><small>Goal · {project.learningGoal}</small></div><span className="project-arrow">→</span></button>)}</div></> }

function ProjectWorkspace({ project }) { return <><div className="workspace-hero"><p className="eyebrow">Project workspace / active</p><h1>{project.title}</h1><p className="lede">{project.description}</p></div><div className="workspace-grid"><div className="empty-module"><span className="module-number">01</span><span className="section-label">Materials</span><h2>Bring your sources here.</h2><p>PDFs, notes, and links will become the grounding layer for your tutor.</p></div><div className="empty-module"><span className="module-number">02</span><span className="section-label">Tutor</span><h2>Ask better questions.</h2><p>Your project conversation will stay connected to what you are learning.</p></div><div className="empty-module"><span className="module-number">03</span><span className="section-label">Progress</span><h2>See understanding grow.</h2><p>Quizzes and mastery signals will appear as you practice.</p></div></div></> }

export default App
