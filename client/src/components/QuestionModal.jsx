import { useState, useEffect } from 'react'

function QuestionModal({ questions, onAnswer, onSkip }) {
  const [answer, setAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(600)
  const currentQuestion = questions[0]

  useEffect(() => {
    if (!currentQuestion) return

    const timer = setInterval(() => {
      const askedAt = new Date(currentQuestion.askedAt)
      const elapsed = (Date.now() - askedAt) / 1000
      const remaining = Math.max(0, 600 - elapsed)
      setTimeLeft(Math.floor(remaining))
    }, 1000)

    return () => clearInterval(timer)
  }, [currentQuestion])

  if (!currentQuestion) return null

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!answer.trim()) return
    onAnswer(currentQuestion.questionId, answer.trim())
    setAnswer('')
  }

  function handleSkip() {
    onSkip(currentQuestion.questionId)
    setAnswer('')
  }

  // Extract just the question part (last few lines)
  const questionText = currentQuestion.question
  const lines = questionText.split('\n')
  const displayText = lines.length > 20
    ? '...\n' + lines.slice(-20).join('\n')
    : questionText

  return (
    <div className="question-modal-overlay">
      <div className="question-modal">
        <div className="question-header">
          <h3>Claude needs input</h3>
          <span className="timeout-badge">
            Auto-skip in {formatTime(timeLeft)}
          </span>
        </div>

        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
          Task: {currentQuestion.taskId}
        </div>

        <pre className="question-text">{displayText}</pre>

        <form className="answer-form" onSubmit={handleSubmit}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            autoFocus
          />
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={handleSkip}>
              Skip
            </button>
            <button type="submit" className="btn btn-primary" disabled={!answer.trim()}>
              Submit Answer
            </button>
          </div>
        </form>

        {questions.length > 1 && (
          <p style={{ marginTop: 12, fontSize: 12, color: '#8b949e' }}>
            +{questions.length - 1} more question(s) waiting
          </p>
        )}
      </div>
    </div>
  )
}

export default QuestionModal
