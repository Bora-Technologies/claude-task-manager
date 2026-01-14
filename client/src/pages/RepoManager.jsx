import { useState, useEffect } from 'react'
import { api } from '../api'

function RepoManager() {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [alias, setAlias] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')
  const [editingRepo, setEditingRepo] = useState(null)
  const [editAlias, setEditAlias] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editNotes, setEditNotes] = useState('')

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

  function startEdit(repo) {
    setEditingRepo(repo.alias)
    setEditAlias(repo.alias)
    setEditDescription(repo.description || '')
    setEditNotes(repo.notes || '')
  }

  function cancelEdit() {
    setEditingRepo(null)
    setEditAlias('')
    setEditDescription('')
    setEditNotes('')
  }

  async function handleUpdate(oldAlias) {
    try {
      await api.updateRepo(oldAlias, {
        alias: editAlias.trim().toLowerCase(),
        description: editDescription,
        notes: editNotes
      })
      cancelEdit()
      loadRepos()
    } catch (err) {
      alert('Failed to update: ' + err.message)
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
              {editingRepo === repo.alias ? (
                <div>
                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="Alias"
                      value={editAlias}
                      onChange={(e) => setEditAlias(e.target.value)}
                      style={{ fontWeight: 'bold' }}
                      required
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="Description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <textarea
                      placeholder="Notes (e.g., tech stack, important files, context for Claude)"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      style={{ flex: 1, minHeight: 80 }}
                    />
                  </div>
                  <div className="form-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => handleUpdate(repo.alias)}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="task-header">
                    <strong>{repo.alias}</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => startEdit(repo)}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDelete(repo.alias)}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#8b949e' }}>
                    {repo.path}
                  </div>
                  {repo.description && (
                    <div style={{ marginTop: 8, fontSize: 14 }}>{repo.description}</div>
                  )}
                  {repo.notes && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#8b949e', whiteSpace: 'pre-wrap' }}>
                      Notes: {repo.notes}
                    </div>
                  )}
                  <div className="task-meta" style={{ marginTop: 8 }}>
                    <span>Tasks: {repo.taskCount}</span>
                    <span>Success: {repo.successCount}</span>
                    <span>Failed: {repo.failCount}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RepoManager
