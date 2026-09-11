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

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/health`)
      .then((response) => (response.ok ? setApiStatus('Online') : setApiStatus('Unavailable')))
      .catch(() => setApiStatus('Unavailable'))
  }, [])

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand-mark"><span>SC</span> Study Companion</div>
        <div className="environment"><span className="status-dot" /> Local foundation <strong>{apiStatus}</strong></div>
      </nav>
      <section className="intro">
        <p className="eyebrow">AI learning system / foundation</p>
        <h1>Build understanding that <em>stays with you.</em></h1>
        <p className="lede">A focused workspace for turning study material into grounded conversations, deliberate practice, and visible progress.</p>
      </section>
      <section className="foundation-grid" aria-label="Foundation status">
        <div className="path-card">
          <div className="card-heading"><span className="section-label">Critical loop</span><span className="mono-label">01 / 15</span></div>
          <h2>Material to mastery</h2>
          <p>The product spine is ready for the first demonstrable slice: bring in a source, ask a grounded question, practice the idea, and measure what changed.</p>
          <div className="loop-line"><span>Space</span><i>→</i><span>Material</span><i>→</i><span>Tutor</span><i>→</i><span>Mastery</span></div>
        </div>
        <div className="status-card">
          <div className="card-heading"><span className="section-label">System status</span><span className="pulse" /></div>
          <ul>{checks.map((check) => <li key={check.label}><div><strong>{check.label}</strong><small>{check.detail}</small></div><span className={`check-status ${check.status === 'Pending' ? 'pending' : ''}`}>{check.status}</span></li>)}</ul>
        </div>
      </section>
      <footer><span>v0.1 foundation</span><span>Modular monolith · local first</span></footer>
    </main>
  )
}

export default App
