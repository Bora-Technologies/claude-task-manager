import { Router } from 'express';
import Task from '../models/Task.js';
import Log from '../models/Log.js';

const router = Router();

// List all tasks
router.get('/', async (req, res) => {
  try {
    const { status, repo, limit = 50, skip = 0, sort = 'createdAt', order = 'desc' } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (repo) filter.repo = repo;

    const tasks = await Task.find(filter)
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await Task.countDocuments(filter);

    res.json({ tasks, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get bulk task status (for polling)
router.get('/bulk-status', async (req, res) => {
  try {
    const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
    if (ids.length === 0) {
      return res.json({ tasks: [] });
    }
    const tasks = await Task.find(
      { taskId: { $in: ids } },
      { taskId: 1, status: 1, response: 1, error: 1, completedAt: 1 }
    );
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
router.post('/', async (req, res) => {
  try {
    const { repo, instruction, priority = 5, source = 'api' } = req.body;

    if (!repo || !instruction) {
      return res.status(400).json({ error: 'repo and instruction are required' });
    }

    const task = await Task.create({ repo, instruction, priority, source });

    // Emit to connected clients
    const io = req.app.get('io');
    if (io) io.emit('task:created', { task });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.patch('/:id', async (req, res) => {
  try {
    const { priority } = req.body;
    const task = await Task.findOneAndUpdate(
      { taskId: req.params.id, status: 'pending' },
      { priority },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found or not pending' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel task
router.post('/:id/cancel', async (req, res) => {
  try {
    const taskRunner = req.app.get('taskRunner');
    const task = await Task.findOne({ taskId: req.params.id });

    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.status === 'running' && taskRunner) {
      await taskRunner.cancelTask(req.params.id);
    } else if (task.status === 'pending' || task.status === 'waiting_answer') {
      task.status = 'cancelled';
      task.completedAt = new Date();
      await task.save();

      const io = req.app.get('io');
      if (io) io.emit('task:cancelled', { taskId: task.taskId });
    } else {
      return res.status(400).json({ error: 'Task cannot be cancelled' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ taskId: req.params.id, status: 'pending' });
    if (!task) return res.status(404).json({ error: 'Task not found or not pending' });

    // Delete associated logs
    await Log.deleteMany({ taskId: req.params.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get task logs
router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await Log.find({ taskId: req.params.id }).sort({ sequence: 1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry failed task
router.post('/:id/retry', async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.id, status: 'failed' });
    if (!task) return res.status(404).json({ error: 'Task not found or not failed' });

    task.status = 'pending';
    task.error = null;
    task.startedAt = null;
    task.completedAt = null;
    await task.save();

    const io = req.app.get('io');
    if (io) io.emit('task:created', { task });

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
