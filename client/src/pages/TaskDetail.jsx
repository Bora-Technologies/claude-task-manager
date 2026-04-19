import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { api } from '../api'
import LiveOutput from '../components/LiveOutput'

function TaskDetail() {
  const { id } = useParams()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState(null)
  const [questionHistory, setQuestionHistory] = useState([])
  const [answer, setAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(600)
  const { socket } = useSocket()

  useEffect(() => {
    loadTask()
  }, [id])

  useEffect(() => {
    if (!question) return
    const timer = setInterval(() => {
      const elapsed = (Date.now() - new Date(question.askedAt)) / 1000
      setTimeLeft(Math.max(0, Math.floor(600 - elapsed)))
    }, 1000)
    return () => clearInterval(timer)
  }, [question])

  useEffect(() => {
    if (!socket || !id) return

    socket.emit('subscribe:task', { taskId: id })

    socket.on('task:started', ({ taskId }) => {
      if (taskId === id) setTask(prev => prev ? { ...prev, status: 'running' } : prev)
    })

    socket.on('task:completed', ({ taskId, response }) => {
      if (taskId === id) {
        setTask(prev => prev ? { ...prev, status: 'completed', response } : prev)
        setQuestion(null)
      }
    })

    socket.on('task:failed', ({ taskId, error }) => {
      if (taskId === id) {
        setTask(prev => prev ? { ...prev, status: 'failed', error } : prev)
        setQuestion(null)
      }
    })

    socket.on('task:question', ({ taskId, question: q }) => {
      if (taskId === id) {
        setTask(prev => prev ? { ...prev, status: 'waiting_answer' } : prev)
        setQuestion(q)
        setQuestionHistory(prev => [q, ...prev.filter(h => h.questionId !== q.questionId)])
        setAnswer('')
      }
    })

    socket.on('question:answered', ({ questionId, answer: ans }) => {
      setQuestion(prev => prev?.questionId === questionId ? null : prev)
      setQuestionHistory(prev => prev.map(q =>
        q.questionId === questionId ? { ...q, status: 'answered', answer: ans, answeredAt: new Date() } : q
      ))
      setAnswer('')
    })

    socket.on('question:timeout', ({ questionId }) => {
      setQuestion(prev => prev?.questionId === questionId ? null : prev)
      setQuestionHistory(prev => prev.map(q =>
        q.questionId === questionId ? { ...q, status: 'timeout' } : q
      ))
      setAnswer('')
    })

    return () => {
      socket.emit('unsubscribe:task', { taskId: id })
      socket.off('task:started')
      socket.off('task:completed')
      socket.off('task:failed')
      socket.off('task:question')
      socket.off('question:answered')
      socket.off('question:timeout')
    }
  }, [socket, id, question])

  async function loadTask() {
    try {
      const [data, allQuestions] = await Promise.all([
        api.getTask(id),
        api.getTaskQuestions(id)
      ])
      setTask(data)
      setQuestionHistory(allQuestions)

      if (data.status === 'waiting_answer') {
        const q = allQuestions.find(q => q.status === 'pending')
        if (q) setQuestion(q)
      }
    } catch (err) {
      console.error('Failed to load task:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this task?')) return
    try {
      await api.cancelTask(id)
      loadTask()
    } catch (err) {
      alert('Failed to cancel: ' + err.message)
    }
  }

  async function handleRetry() {
    try {
      await api.retryTask(id)
      loadTask()
    } catch (err) {
      alert('Failed to retry: ' + err.message)
    }
  }

  async function handleAnswer(e) {
    e.preventDefault()
    if (!answer.trim() || !question) return
    try {
      const updated = await api.answerQuestion(question.questionId, answer.trim())
      setQuestion(null)
      setAnswer('')
      setQuestionHistory(prev => prev.map(q => q.questionId === updated.questionId ? updated : q))
    } catch (err) {
      alert('Failed to submit answer: ' + err.message)
    }
  }

  async function handleSkip() {
    if (!question) return
    try {
      const updated = await api.skipQuestion(question.questionId)
      setQuestion(null)
      setAnswer('')
      setQuestionHistory(prev => prev.map(q => q.questionId === updated.questionId ? updated : q))
    } catch (err) {
      alert('Failed to skip: ' + err.message)
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (loading) return <div className="empty-state">Loading...</div>
  if (!task) return <div className="empty-state">Task not found</div>

  return (
    <div>
      <Link to="/" className="back-link">Back to tasks</Link>

      <div className="task-detail">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <h2>{task.taskId}</h2>
          <span className={`task-status ${task.status}`}>{task.status}</span>
        </div>

        <div className="detail-grid">
          <span className="detail-label">Repo:</span>
          <span>{task.repo}</span>

          <span className="detail-label">Priority:</span>
          <span>{task.priority}</span>

          <span className="detail-label">Created:</span>
          <span>{new Date(task.createdAt).toLocaleString()}</span>

          {task.startedAt && (
            <>
              <span className="detail-label">Started:</span>
              <span>{new Date(task.startedAt).toLocaleString()}</span>
            </>
          )}

          {task.completedAt && (
            <>
              <span className="detail-label">Completed:</span>
              <span>{new Date(task.completedAt).toLocaleString()}</span>
            </>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <strong>Instruction:</strong>
          <p style={{ marginTop: 8 }}>{task.instruction}</p>
        </div>

        {task.error && (
          <div style={{ marginBottom: 16, color: '#f85149' }}>
            <strong>Error:</strong>
            <p style={{ marginTop: 8 }}>{task.error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {(task.status === 'pending' || task.status === 'running' || task.status === 'waiting_answer') && (
            <button className="btn btn-danger" onClick={handleCancel}>Cancel</button>
          )}
          {task.status === 'failed' && (
            <button className="btn btn-primary" onClick={handleRetry}>Retry</button>
          )}
        </div>

        {question && (
          <div style={{ marginBottom: 24, border: '1px solid #f0883e', borderRadius: 8, padding: 16, background: '#1a1200' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ color: '#f0883e' }}>Claude needs input</strong>
              <span style={{ fontSize: 12, color: '#8b949e' }}>Auto-skip in {formatTime(timeLeft)}</span>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, marginBottom: 16, color: '#e6edf3', background: 'transparent', border: 'none', padding: 0 }}>
              {question.question.split('\n').length > 20
                ? '...\n' + question.question.split('\n').slice(-20).join('\n')
                : question.question}
            </pre>
            <form onSubmit={handleAnswer}>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                autoFocus
                style={{ width: '100%', minHeight: 80, marginBottom: 12, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '8px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={handleSkip}>Skip</button>
                <button type="submit" className="btn btn-primary" disabled={!answer.trim()}>Submit Answer</button>
              </div>
            </form>
          </div>
        )}

        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Output</h3>
        <LiveOutput taskId={id} isRunning={task.status === 'running'} />

        {questionHistory.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14 }}>Question History ({questionHistory.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...questionHistory].sort((a, b) => new Date(a.askedAt) - new Date(b.askedAt)).map((q, i) => (
                <div key={q.questionId} style={{ border: '1px solid #30363d', borderRadius: 8, padding: 14, background: '#0d1117' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>Q{i + 1} · {new Date(q.askedAt).toLocaleTimeString()}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: q.status === 'answered' ? '#1a3a1a' : q.status === 'pending' ? '#1a2a3a' : '#2a1a1a', color: q.status === 'answered' ? '#3fb950' : q.status === 'pending' ? '#58a6ff' : '#f85149' }}>
                      {q.status}
                    </span>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, color: '#e6edf3', margin: '0 0 10px', background: 'transparent', border: 'none', padding: 0 }}>
                    {q.question.split('\n').length > 15 ? '...\n' + q.question.split('\n').slice(-15).join('\n') : q.question}
                  </pre>
                  {q.status !== 'pending' && (
                    <div style={{ borderTop: '1px solid #21262d', paddingTop: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: '#8b949e' }}>Answer: </span>
                      <span style={{ fontSize: 13, color: q.status === 'answered' ? '#e6edf3' : '#8b949e', fontStyle: q.status !== 'answered' ? 'italic' : 'normal' }}>
                        {q.status === 'answered' ? q.answer : q.status === 'skipped' ? 'Skipped by user' : 'Timed out'}
                      </span>
                      {q.answeredAt && (
                        <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 8 }}>· {new Date(q.answeredAt).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskDetail
