import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  taskId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  stream: {
    type: String,
    enum: ['stdout', 'stderr', 'system'],
    default: 'stdout'
  },
  content: { type: String, required: true },
  sequence: { type: Number, default: 0 }
}, { timestamps: false });

logSchema.index({ task: 1, sequence: 1 });

export default mongoose.model('Log', logSchema);
