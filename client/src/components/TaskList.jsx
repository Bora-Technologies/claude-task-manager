function TaskList({ tasks, onTaskClick }) {
  if (tasks.length === 0) {
    return <div className="empty-state">No tasks yet. Create one above.</div>
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <div
          key={task.taskId}
          className={`task-card ${task.status}`}
          onClick={() => onTaskClick(task)}
        >
          <div className="task-header">
            <span className="task-id">{task.taskId}</span>
            <span className={`task-status ${task.status}`}>{task.status.replace('_', ' ')}</span>
          </div>
          <div className="task-instruction">
            {task.instruction.length > 150
              ? task.instruction.slice(0, 150) + '...'
              : task.instruction}
          </div>
          <div className="task-meta">
            <span>Repo: {task.repo}</span>
            <span>Priority: {task.priority}</span>
            <span>{new Date(task.createdAt).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TaskList
