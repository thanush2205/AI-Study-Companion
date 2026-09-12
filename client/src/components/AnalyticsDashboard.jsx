import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const coral = '#e36750'
const mint = '#41a37c'
const gold = '#d9a441'
const ink = '#22302a'
const line = '#e7e0d4'
const palette = [coral, mint, gold, '#7a9bd4', '#b06ab3']

function StatCard({ label, value, sub }) {
  return (
    <div className="analytics-stat">
      <span className="section-label">{label}</span>
      <strong>{value}</strong>
      {sub ? <p>{sub}</p> : null}
    </div>
  )
}

export default function AnalyticsDashboard({ analytics }) {
  const data = analytics ?? {}
  const [section, setSection] = useState('overview')

  const activityData = useMemo(() => (data.activity?.byType ?? []).map((row) => ({
    name: row.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    events: row.count,
  })), [data])

  const levelData = useMemo(() => {
    const levels = data.mastery?.levelDistribution ?? {}
    return Object.entries(levels).map(([name, count]) => ({ name, count }))
  }, [data])

  const aiOperationData = useMemo(() => (data.aiUsage?.byOperation ?? []).map((row) => ({
    name: row.operation.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    calls: row.calls,
  })), [data])

  const masteryTrend = useMemo(() => (data.masteryTrend ?? []).map((row) => ({
    week: row.week,
    mastery: row.masteryPercent,
  })), [data])

  const quiz = data.quiz ?? {}
  const sessions = data.sessions ?? {}
  const mastery = data.mastery ?? {}
  const aiUsage = data.aiUsage ?? {}

  return (
    <div className="analytics-dashboard">
      <div className="section-heading">
        <div>
          <span className="section-label">Analytics</span>
          <h2>How your learning is compounding</h2>
        </div>
        <div className="analytics-tabs">
          <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}>Overview</button>
          <button className={section === 'activity' ? 'active' : ''} onClick={() => setSection('activity')}>Activity</button>
          <button className={section === 'usage' ? 'active' : ''} onClick={() => setSection('usage')}>AI usage</button>
        </div>
      </div>

      {section === 'overview' && (
        <>
          <div className="analytics-stat-grid">
            <StatCard label="Learning sessions" value={sessions.total ?? 0} sub={`${sessions.averageMessagesPerSession ?? 0} messages per session`} />
            <StatCard label="Tutor questions" value={sessions.tutorQuestions ?? 0} sub={`${sessions.tutorAnswers ?? 0} tutor responses`} />
            <StatCard label="Quiz accuracy" value={`${quiz.accuracy ?? 0}%`} sub={`${quiz.attempts ?? 0} attempts`} />
            <StatCard label="Average mastery" value={`${mastery.averageMastery ?? 0}%`} sub={`${mastery.trackedConcepts ?? 0} concepts tracked`} />
          </div>
          <div className="analytics-chart-grid">
            <div className="analytics-chart-panel">
              <span className="section-label">Mastery distribution</span>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={levelData} dataKey="count" nameKey="name" innerRadius={46} outerRadius={82} paddingAngle={4}>
                    {levelData.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '.68rem', textTransform: 'capitalize' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-chart-panel">
              <span className="section-label">Mastery over time</span>
              {masteryTrend.length ? (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={masteryTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={line} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke={ink} />
                    <YAxis tick={{ fontSize: 11 }} stroke={ink} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="mastery" stroke={mint} strokeWidth={2} dot={{ r: 3, fill: mint }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="analytics-empty">Complete quizzes and assessments to see your mastery trend.</div>
              )}
            </div>
          </div>
          <div className="analytics-lists">
            <div className="analytics-chart-panel">
              <span className="section-label">Concepts mastered</span>
              {mastery.masteredConcepts?.length ? mastery.masteredConcepts.map((c) => (
                <div className="analytics-progress-row" key={c.conceptId}>
                  <span>{c.concept}</span>
                  <div className="progress-track"><i style={{ width: `${c.masteryPercent}%` }} /></div>
                  <strong>{c.masteryPercent}%</strong>
                </div>
              )) : <div className="analytics-empty">Nothing mastered yet.</div>}
            </div>
            <div className="analytics-chart-panel">
              <span className="section-label">Concepts needing attention</span>
              {mastery.conceptsNeedingAttention?.length ? mastery.conceptsNeedingAttention.map((c) => (
                <div className="analytics-progress-row" key={c.conceptId}>
                  <span>{c.concept}</span>
                  <div className="progress-track warm"><i style={{ width: `${c.masteryPercent}%` }} /></div>
                  <strong>{c.masteryPercent}%</strong>
                </div>
              )) : <div className="analytics-empty">No weak spots right now.</div>}
            </div>
          </div>
        </>
      )}

      {section === 'activity' && (
        <div className="analytics-chart-grid">
          <div className="analytics-chart-panel wide">
            <span className="section-label">Events by type</span>
            {activityData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={line} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke={ink} interval={0} angle={-18} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} stroke={ink} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="events" fill={coral} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="analytics-empty">No activity recorded yet.</div>}
          </div>
        </div>
      )}

      {section === 'usage' && (
        <div className="analytics-chart-grid">
          <div className="analytics-chart-panel wide">
            <span className="section-label">AI calls by operation</span>
            {aiOperationData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={aiOperationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={line} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke={ink} interval={0} angle={-18} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} stroke={ink} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="calls" fill={mint} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="analytics-empty">No AI usage recorded yet.</div>}
            <div className="analytics-stat-strip">
              <StatCard label="AI calls" value={aiUsage.calls ?? 0} />
              <StatCard label="Input tokens" value={(aiUsage.inputTokens ?? 0).toLocaleString()} />
              <StatCard label="Output tokens" value={(aiUsage.outputTokens ?? 0).toLocaleString()} />
              <StatCard label="Estimated cost" value={`$${aiUsage.cost ?? 0}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}