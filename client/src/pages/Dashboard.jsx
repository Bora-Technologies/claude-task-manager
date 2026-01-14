import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { api } from '../api'
import CreateTaskForm from '../components/CreateTaskForm'
import TaskList from '../components/TaskList'
import QuestionModal from '../components/QuestionModal'

function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [questions, setQuestions] = useState([])
  const [stats, setStats] = useState({ pending: 0, running: 0, waiting: 0 })
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('task:created', ({ task }) => {
      setTasks(prev => [task, ...prev])
      setStats(prev => ({ ...prev, pending: prev.pending + 1 }))
    })

    socket.on('task:started', ({ taskId }) => {
      setTasks(prev => prev.map(t =>
        t.taskId === taskId ? { ...t, status: 'running' } : t
      ))
    })

    socket.on('task:completed', ({ taskId }) => {
      setTasks(prev => prev.map(t =>
        t.taskId === taskId ? { ...t, status: 'completed' } : t
      ))
    })

    socket.on('task:failed', ({ taskId, error }) => {
      setTasks(prev => prev.map(t =>
        t.taskId === taskId ? { ...t, status: 'failed', error } : t
      ))
    })

    socket.on('task:cancelled', ({ taskId }) => {
      setTasks(prev => prev.map(t =>
        t.taskId === taskId ? { ...t, status: 'cancelled' } : t
      ))
    })

    socket.on('task:question', ({ question }) => {
      setQuestions(prev => [...prev, question])
      setTasks(prev => prev.map(t =>
        t.taskId === question.taskId ? { ...t, status: 'waiting_answer' } : t
      ))
    })

    socket.on('question:answered', ({ questionId }) => {
      setQuestions(prev => prev.filter(q => q.questionId !== questionId))
    })

    socket.on('question:timeout', ({ questionId }) => {
      setQuestions(prev => prev.filter(q => q.questionId !== questionId))
    })

    socket.on('queue:update', setStats)

    return () => {
      socket.off('task:created')
      socket.off('task:started')
      socket.off('task:completed')
      socket.off('task:failed')
      socket.off('task:cancelled')
      socket.off('task:question')
      socket.off('question:answered')
      socket.off('question:timeout')
      socket.off('queue:update')
    }
  }, [socket])

  async function loadData() {
    try {
      const [tasksData, questionsData] = await Promise.all([
        api.getTasks({ limit: 50 }),
        api.getPendingQuestions()
      ])
      setTasks(tasksData.tasks)
      setQuestions(questionsData)

      const pending = tasksData.tasks.filter(t => t.status === 'pending').length
      const running = tasksData.tasks.filter(t => t.status === 'running').length
      const waiting = tasksData.tasks.filter(t => t.status === 'waiting_answer').length
      setStats({ pending, running, waiting })
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnswer(questionId, answer) {
    try {
      await api.answerQuestion(questionId, answer)
      setQuestions(prev => prev.filter(q => q.questionId !== questionId))
    } catch (err) {
      alert('Failed to submit answer: ' + err.message)
    }
  }

  async function handleSkip(questionId) {
    try {
      await api.skipQuestion(questionId)
      setQuestions(prev => prev.filter(q => q.questionId !== questionId))
    } catch (err) {
      alert('Failed to skip: ' + err.message)
    }
  }

  function handleTaskClick(task) {
    navigate(`/task/${task.taskId}`)
  }

  if (loading) {
    return <div className="empty-state">Loading...</div>
  }

  return (
    <div>
      <div className="status-bar" style={{ marginBottom: 24 }}>
        <span className="status-badge pending">{stats.pending} pending</span>
        <span className="status-badge running">{stats.running} running</span>
        <span className="status-badge waiting">{stats.waiting} waiting</span>
      </div>

      <CreateTaskForm onCreated={loadData} />

      <h2 style={{ marginBottom: 16, fontSize: 16 }}>Tasks</h2>
      <TaskList tasks={tasks} onTaskClick={handleTaskClick} />

      {questions.length > 0 && (
        <QuestionModal
          questions={questions}
          onAnswer={handleAnswer}
          onSkip={handleSkip}
        />
      )}
    </div>
  )
}

export default Dashboard
