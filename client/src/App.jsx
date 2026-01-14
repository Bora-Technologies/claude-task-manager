import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useSocket } from './context/SocketContext'
import Dashboard from './pages/Dashboard'
import TaskDetail from './pages/TaskDetail'
import RepoManager from './pages/RepoManager'

function App() {
  const { connected } = useSocket()
  const location = useLocation()

  return (
    <div className="app">
      <header className="header">
        <h1>Claude Task Manager</h1>
        <div className="status-bar">
          <span className={`status-badge ${connected ? 'running' : ''}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <nav className="nav-tabs">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Tasks</Link>
        <Link to="/repos" className={location.pathname === '/repos' ? 'active' : ''}>Repos</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/task/:id" element={<TaskDetail />} />
        <Route path="/repos" element={<RepoManager />} />
      </Routes>
    </div>
  )
}

export default App
