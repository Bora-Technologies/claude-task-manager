const API_URL = import.meta.env.VITE_API_URL || ''

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}/api${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

export const api = {
  // Tasks
  getTasks: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/tasks${query ? `?${query}` : ''}`)
  },
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  cancelTask: (id) => request(`/tasks/${id}/cancel`, { method: 'POST' }),
  retryTask: (id) => request(`/tasks/${id}/retry`, { method: 'POST' }),
  getTaskLogs: (id) => request(`/tasks/${id}/logs`),

  // Questions
  getPendingQuestions: () => request('/questions/pending'),
  answerQuestion: (id, answer) => request(`/questions/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }),
  skipQuestion: (id) => request(`/questions/${id}/skip`, { method: 'POST' }),

  // Repos
  getRepos: () => request('/repos'),
  createRepo: (data) => request('/repos', { method: 'POST', body: JSON.stringify(data) }),
  updateRepo: (alias, data) => request(`/repos/${alias}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRepo: (alias) => request(`/repos/${alias}`, { method: 'DELETE' }),

  // System
  getSystemStatus: () => request('/system/status'),
  pauseSystem: () => request('/system/pause', { method: 'POST' }),
  resumeSystem: () => request('/system/resume', { method: 'POST' }),

  // Auth
  login: (password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  checkAuth: () => request('/auth/check')
}
