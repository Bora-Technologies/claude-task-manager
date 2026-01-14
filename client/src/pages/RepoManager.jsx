import { useState, useEffect } from 'react'
import { api } from '../api'

function RepoManager() {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [alias, setAlias] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadRepos()
  }, [])

  async function loadRepos() {
    try {
      const data = await api.getRepos()
      setRepos(data)
    } catch (err) {
      console.error('Failed to load repos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await api.createRepo({ alias, path, description })
      setAlias('')
      setPath('')
      setDescription('')
      loadRepos()
    } catch (err) {
      alert('Failed to add repo: ' + err.message)
    }
  }

  async function handleDelete(repoAlias) {
    if (!confirm(`Delete repo "${repoAlias}"?`)) return
    try {
      await api.deleteRepo(repoAlias)
      loadRepos()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  if (loading) {
    return <div className="empty-state">Loading...</div>
  }

  return (
    <div>
      <div className="create-form">
        <h2>Add Repository</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Alias (e.g., jumbl)"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Full path (e.g., /home/ubuntu/repos/jumbl)"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              style={{ flex: 1 }}
              required
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">Add Repo</button>
          </div>
        </form>
      </div>

      <h2 style={{ marginBottom: 16, fontSize: 16 }}>Repositories ({repos.length})</h2>

      {repos.length === 0 ? (
        <div className="empty-state">No repositories configured</div>
      ) : (
        <div className="task-list">
          {repos.map(repo => (
            <div key={repo.alias} className="task-card">
              <div className="task-header">
                <strong>{repo.alias}</strong>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(repo.alias)}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  Delete
                </button>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#8b949e' }}>
                {repo.path}
              </div>
              {repo.description && (
                <div style={{ marginTop: 8, fontSize: 14 }}>{repo.description}</div>
              )}
              <div className="task-meta" style={{ marginTop: 8 }}>
                <span>Tasks: {repo.taskCount}</span>
                <span>Success: {repo.successCount}</span>
                <span>Failed: {repo.failCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RepoManager
