import Question from '../models/Question.js';
import Task from '../models/Task.js';

export default function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    // Subscribe to specific task
    socket.on('subscribe:task', ({ taskId }) => {
      socket.join(`task:${taskId}`);
      console.log(`[Socket] ${socket.id} subscribed to task:${taskId}`);
    });

    // Unsubscribe from task
    socket.on('unsubscribe:task', ({ taskId }) => {
      socket.leave(`task:${taskId}`);
      console.log(`[Socket] ${socket.id} unsubscribed from task:${taskId}`);
    });

    // Handle answer submission via socket
    socket.on('answer:submit', async ({ questionId, answer }) => {
      try {
        const question = await Question.findOne({ questionId });
        if (question && question.status === 'pending') {
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

          io.emit('question:answered', { questionId, answer });
          console.log(`[Socket] Question answered: ${questionId}`);
        }
      } catch (err) {
        console.error('[Socket] Answer submit error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Handle skip via socket
    socket.on('answer:skip', async ({ questionId }) => {
      try {
        const question = await Question.findOne({ questionId });
        if (question && question.status === 'pending') {
          question.status = 'skipped';
          question.answeredAt = new Date();
          question.answeredBy = 'user';
          await question.save();

          await Task.updateOne(
            { _id: question.task },
            { status: 'pending', currentQuestionId: null }
          );

          io.emit('question:answered', { questionId, answer: null });
          console.log(`[Socket] Question skipped: ${questionId}`);
        }
      } catch (err) {
        console.error('[Socket] Skip error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Handle task cancellation via socket
    socket.on('task:cancel', async ({ taskId }) => {
      try {
        const taskRunner = io.taskRunner;
        if (taskRunner) {
          await taskRunner.cancelTask(taskId);
        }
      } catch (err) {
        console.error('[Socket] Cancel error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });
}
