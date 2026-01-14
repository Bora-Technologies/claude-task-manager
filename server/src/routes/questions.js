import { Router } from 'express';
import Question from '../models/Question.js';
import Task from '../models/Task.js';

const router = Router();

// List questions
router.get('/', async (req, res) => {
  try {
    const { status, taskId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (taskId) filter.taskId = taskId;

    const questions = await Question.find(filter).sort({ askedAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending questions
router.get('/pending', async (req, res) => {
  try {
    const questions = await Question.find({ status: 'pending' }).sort({ askedAt: 1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single question
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findOne({ questionId: req.params.id });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Answer question
router.post('/:id/answer', async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'answer is required' });

    const question = await Question.findOne({ questionId: req.params.id, status: 'pending' });
    if (!question) return res.status(404).json({ error: 'Question not found or already answered' });

    question.status = 'answered';
    question.answer = answer;
    question.answeredAt = new Date();
    question.answeredBy = 'user';
    await question.save();

    // Update task to resume
    await Task.updateOne(
      { _id: question.task },
      { status: 'pending', currentQuestionId: null }
    );

    const io = req.app.get('io');
    if (io) io.emit('question:answered', { questionId: question.questionId, answer });

    res.json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Skip question
router.post('/:id/skip', async (req, res) => {
  try {
    const question = await Question.findOne({ questionId: req.params.id, status: 'pending' });
    if (!question) return res.status(404).json({ error: 'Question not found or already answered' });

    question.status = 'skipped';
    question.answeredAt = new Date();
    question.answeredBy = 'user';
    await question.save();

    // Update task to resume
    await Task.updateOne(
      { _id: question.task },
      { status: 'pending', currentQuestionId: null }
    );

    const io = req.app.get('io');
    if (io) io.emit('question:answered', { questionId: question.questionId, answer: null });

    res.json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
