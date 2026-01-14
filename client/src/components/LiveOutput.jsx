import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../context/SocketContext'
import { api } from '../api'

function LiveOutput({ taskId, isRunning }) {
  const [logs, setLogs] = useState([])
  const outputRef = useRef(null)
  const { socket } = useSocket()

  useEffect(() => {
    // Load existing logs
    api.getTaskLogs(taskId).then(setLogs).catch(console.error)
  }, [taskId])

  useEffect(() => {
    if (!socket || !isRunning) return

    socket.on('task:output', (data) => {
      if (data.taskId === taskId) {
        setLogs(prev => [...prev, data])
      }
    })

    return () => {
      socket.off('task:output')
    }
  }, [socket, taskId, isRunning])

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [logs])

  if (logs.length === 0) {
    return (
      <div className="live-output" style={{ color: '#8b949e' }}>
        {isRunning ? 'Waiting for output...' : 'No output yet'}
      </div>
    )
  }

  return (
    <div className="live-output" ref={outputRef}>
      {logs.map((log, i) => (
        <div key={i} className={`log-line ${log.stream}`}>
          <span className="timestamp">
            {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
          </span>
          <span>{log.content}</span>
        </div>
      ))}
    </div>
  )
}

export default LiveOutput
