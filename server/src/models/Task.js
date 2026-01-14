import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  taskId: {
    type: String,
    required: true,
    unique: true,
    default: () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  },
  repo: {
    type: String,
    required: true
  },
  instruction: {
    type: String,
    required: true
  },
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'waiting_answer', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
  response: { type: String },
  error: { type: String },
  exitCode: { type: Number },
  questionCount: { type: Number, default: 0 },
  currentQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  source: {
    type: String,
    enum: ['api', 'web', 'mobile'],
    default: 'api'
  }
}, { timestamps: true });

taskSchema.index({ status: 1, priority: 1, createdAt: 1 });

export default mongoose.model('Task', taskSchema);
