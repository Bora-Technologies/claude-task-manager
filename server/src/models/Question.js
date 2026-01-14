import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true,
    default: () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  taskId: { type: String, required: true },
  question: { type: String, required: true },
  context: { type: String },
  answer: { type: String },
  status: {
    type: String,
    enum: ['pending', 'answered', 'skipped', 'timeout'],
    default: 'pending'
  },
  askedAt: { type: Date, default: Date.now },
  answeredAt: { type: Date },
  timeoutAt: { type: Date },
  answeredBy: { type: String }
}, { timestamps: true });

questionSchema.index({ task: 1 });
questionSchema.index({ status: 1 });

export default mongoose.model('Question', questionSchema);
