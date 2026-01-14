import { useState, useEffect } from 'react'
import { api } from '../api'

function CreateTaskForm({ onCreated }) {
  const [repos, setRepos] = useState([])
  const [repo, setRepo] = useState('')
  const [instruction, setInstruction] = useState('')
  const [priority, setPriority] = useState(5)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getRepos().then(setRepos).catch(console.error)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!repo || !instruction.trim()) return

    setLoading(true)
    try {
      await api.createTask({ repo, instruction: instruction.trim(), priority })
      setInstruction('')
      setPriority(5)
      if (onCreated) onCreated()
    } catch (err) {
      alert('Failed to create task: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-form">
      <h2>New Task</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <select value={repo} onChange={(e) => setRepo(e.target.value)} required>
            <option value="">Select repo...</option>
            {repos.map(r => (
              <option key={r.alias} value={r.alias}>{r.alias}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Priority:
            <input
              type="number"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <textarea
            placeholder="Task instruction for Claude..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            required
          />
        </div>
        <div className="form-row" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || !repo || !instruction.trim()}>
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateTaskForm
