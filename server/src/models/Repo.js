import mongoose from 'mongoose';

const repoSchema = new mongoose.Schema({
  alias: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  path: {
    type: String,
    required: true
  },
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date },
  taskCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failCount: { type: Number, default: 0 },
  description: { type: String },
  notes: { type: String },
  tags: [{ type: String }]
}, { timestamps: true });

export default mongoose.model('Repo', repoSchema);
