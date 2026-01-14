import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { api } from '../api'
import LiveOutput from '../components/LiveOutput'

function TaskDetail() {
  const { id } = useParams()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()

  useEffect(() => {
    loadTask()
  }, [id])

  useEffect(() => {
    if (!socket || !id) return

    socket.emit('subscribe:task', { taskId: id })

    socket.on('task:started', ({ taskId }) => {
      if (taskId === id) {
        setTask(prev => prev ? { ...prev, status: 'running' } : prev)
      }
    })

    socket.on('task:completed', ({ taskId, response }) => {
      if (taskId === id) {
        setTask(prev => prev ? { ...prev, status: 'completed', response } : prev)
      }
    })

    socket.on('task:failed', ({ taskId, error }) => {
      if (taskId === id) {
        setTask(prev => prev ? { ...prev, status: 'failed', error } : prev)
      }
    })

    return () => {
      socket.emit('unsubscribe:task', { taskId: id })
      socket.off('task:started')
      socket.off('task:completed')
      socket.off('task:failed')
    }
  }, [socket, id])

  async function loadTask() {
    try {
      const data = await api.getTask(id)
      setTask(data)
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

  if (loading) {
    return <div className="empty-state">Loading...</div>
  }

  if (!task) {
    return <div className="empty-state">Task not found</div>
  }

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

        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Output</h3>
        <LiveOutput taskId={id} isRunning={task.status === 'running'} />
      </div>
    </div>
  )
}

export default TaskDetail
