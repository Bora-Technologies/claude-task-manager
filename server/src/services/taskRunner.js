import { spawn, exec } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import Task from '../models/Task.js';
import Question from '../models/Question.js';
import Repo from '../models/Repo.js';
import Log from '../models/Log.js';

class TaskRunner {
  constructor(io) {
    this.io = io;
    this.currentTask = null;
    this.isPaused = false;
    this.childProcess = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[TaskRunner] Started');

    while (this.isRunning) {
      try {
        if (this.isPaused || this.currentTask) {
          await this.sleep(1000);
          continue;
        }

        const task = await this.getNextTask();
        if (!task) {
          await this.sleep(2000);
          continue;
        }

        await this.executeTask(task);
      } catch (err) {
        console.error('[TaskRunner] Error:', err);
        await this.sleep(5000);
      }
    }
  }

  stop() {
    this.isRunning = false;
    if (this.childProcess) {
      this.childProcess.kill('SIGTERM');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getNextTask() {
    const task = await Task.findOne({
      status: 'pending',
      currentQuestionId: null
    }).sort({ priority: 1, createdAt: 1 });

    return task;
  }

  async executeTask(task) {
    this.currentTask = task;
    console.log(`[TaskRunner] Executing task: ${task.taskId}`);

    // Update status
    task.status = 'running';
    task.startedAt = new Date();
    await task.save();

    // Emit start event
    this.io.emit('task:started', { taskId: task.taskId, startedAt: task.startedAt });
    this.io.emit('queue:update', await this.getQueueStats());

    // Get repo path
    const repoPath = await this.resolveRepoPath(task.repo);
    if (!repoPath) {
      return this.failTask(task, `Invalid repo: ${task.repo}`);
    }

    // Build prompt with previous answers
    const prompt = await this.buildPrompt(task);

    // Spawn Claude process
    const claudePath = process.env.CLAUDE_PATH || 'claude';
    const args = ['-p', prompt, '--permission-mode', 'bypassPermissions'];

    console.log(`[TaskRunner] Running: ${claudePath} ${args.join(' ')}`);
    console.log(`[TaskRunner] CWD: ${repoPath}`);

    // Note: shell: false (default) to avoid prompt being interpreted by shell
    // Arguments are passed directly to the executable
    this.childProcess = spawn(claudePath, args, {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let fullOutput = '';
    let sequence = 0;

    // Stream stdout
    this.childProcess.stdout.on('data', async (data) => {
      const content = data.toString();
      fullOutput += content;
      sequence++;

      // Save to DB
      try {
        await Log.create({
          task: task._id,
          taskId: task.taskId,
          stream: 'stdout',
          content,
          sequence
        });
      } catch (err) {
        console.error('[TaskRunner] Log save error:', err);
      }

      // Emit to WebSocket
      this.io.to(`task:${task.taskId}`).emit('task:output', {
        taskId: task.taskId,
        content,
        stream: 'stdout',
        timestamp: new Date()
      });
    });

    // Stream stderr
    this.childProcess.stderr.on('data', async (data) => {
      const content = data.toString();
      fullOutput += content;
      sequence++;

      try {
        await Log.create({
          task: task._id,
          taskId: task.taskId,
          stream: 'stderr',
          content,
          sequence
        });
      } catch (err) {
        console.error('[TaskRunner] Log save error:', err);
      }

      this.io.to(`task:${task.taskId}`).emit('task:output', {
        taskId: task.taskId,
        content,
        stream: 'stderr',
        timestamp: new Date()
      });
    });

    // Handle process completion
    return new Promise((resolve) => {
      this.childProcess.on('close', async (code) => {
        console.log(`[TaskRunner] Claude exited with code: ${code}`);

        // Check if Claude asked a question
        const askedQuestion = this.detectQuestion(fullOutput);

        if (askedQuestion) {
          await this.handleQuestion(task, fullOutput);
        } else if (code === 0) {
          await this.completeTask(task, fullOutput);
        } else {
          await this.failTask(task, `Claude exited with code ${code}`, code);
        }

        this.currentTask = null;
        this.childProcess = null;
        resolve();
      });

      this.childProcess.on('error', async (err) => {
        console.error('[TaskRunner] Process error:', err);
        await this.failTask(task, err.message);
        this.currentTask = null;
        this.childProcess = null;
        resolve();
      });
    });
  }

  detectQuestion(output) {
    const lines = output.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return false;
    const lastLine = lines[lines.length - 1].trim();
    return lastLine.endsWith('?');
  }

  async handleQuestion(task, output) {
    console.log(`[TaskRunner] Question detected for task: ${task.taskId}`);

    const timeoutMs = parseInt(process.env.QUESTION_TIMEOUT_MS) || 600000;

    // Create question record
    const question = await Question.create({
      task: task._id,
      taskId: task.taskId,
      question: output.trim(),
      status: 'pending',
      askedAt: new Date(),
      timeoutAt: new Date(Date.now() + timeoutMs)
    });

    // Update task
    task.status = 'waiting_answer';
    task.questionCount += 1;
    task.currentQuestionId = question._id;
    await task.save();

    // Emit events
    this.io.emit('task:question', { taskId: task.taskId, question });
    this.io.emit('queue:update', await this.getQueueStats());

    // Schedule timeout
    this.scheduleQuestionTimeout(question, timeoutMs);
  }

  scheduleQuestionTimeout(question, timeoutMs) {
    setTimeout(async () => {
      try {
        const q = await Question.findById(question._id);
        if (q && q.status === 'pending') {
          console.log(`[TaskRunner] Question timeout: ${q.questionId}`);

          q.status = 'timeout';
          q.answeredAt = new Date();
          q.answeredBy = 'timeout';
          await q.save();

          // Update task to resume
          const task = await Task.findById(q.task);
          if (task) {
            task.status = 'pending';
            task.currentQuestionId = null;
            await task.save();
          }

          this.io.emit('question:timeout', { questionId: q.questionId, taskId: q.taskId });
        }
      } catch (err) {
        console.error('[TaskRunner] Timeout handler error:', err);
      }
    }, timeoutMs);
  }

  async buildPrompt(task) {
    let prompt = task.instruction;

    // Get answered questions for this task
    const answered = await Question.find({
      task: task._id,
      status: { $in: ['answered', 'skipped', 'timeout'] }
    }).sort({ askedAt: 1 });

    if (answered.length > 0) {
      prompt += ' [Previous answers: ';
      prompt += answered.map(q => {
        const ans = q.answer || (q.status === 'timeout' ? 'timed out - continue without answer' : 'skipped');
        return `Q: ${q.question.slice(-200)} -> A: ${ans}`;
      }).join('; ');
      prompt += ']';
    }

    return prompt;
  }

  cleanupNodeModules(repoPath) {
    const nmPath = join(repoPath, 'node_modules');
    if (existsSync(nmPath)) {
      exec(`rm -rf "${nmPath}"`, (err) => {
        if (err) console.error(`[TaskRunner] Failed to clean node_modules at ${repoPath}:`, err.message);
        else console.log(`[TaskRunner] Cleaned node_modules at ${repoPath}`);
      });
    }
  }

  async completeTask(task, response) {
    console.log(`[TaskRunner] Task completed: ${task.taskId}`);

    task.status = 'completed';
    task.completedAt = new Date();
    task.response = response;
    task.exitCode = 0;
    await task.save();

    // Update repo stats
    await Repo.findOneAndUpdate(
      { alias: task.repo },
      { $inc: { taskCount: 1, successCount: 1 }, lastUsed: new Date() }
    );

    this.io.emit('task:completed', {
      taskId: task.taskId,
      response,
      completedAt: task.completedAt
    });
    this.io.emit('queue:update', await this.getQueueStats());

    const repoPath = await this.resolveRepoPath(task.repo);
    if (repoPath) this.cleanupNodeModules(repoPath);
  }

  async failTask(task, error, exitCode = 1) {
    console.log(`[TaskRunner] Task failed: ${task.taskId} - ${error}`);

    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;
    task.exitCode = exitCode;
    await task.save();

    await Repo.findOneAndUpdate(
      { alias: task.repo },
      { $inc: { taskCount: 1, failCount: 1 }, lastUsed: new Date() }
    );

    this.io.emit('task:failed', { taskId: task.taskId, error, exitCode });
    this.io.emit('queue:update', await this.getQueueStats());

    const repoPath = await this.resolveRepoPath(task.repo);
    if (repoPath) this.cleanupNodeModules(repoPath);
  }

  async cancelTask(taskId) {
    if (this.currentTask && this.currentTask.taskId === taskId) {
      if (this.childProcess) {
        this.childProcess.kill('SIGTERM');
      }
      this.currentTask.status = 'cancelled';
      this.currentTask.completedAt = new Date();
      await this.currentTask.save();
      this.io.emit('task:cancelled', { taskId });
    }
  }

  async getQueueStats() {
    const pending = await Task.countDocuments({ status: 'pending' });
    const running = await Task.countDocuments({ status: 'running' });
    const waiting = await Task.countDocuments({ status: 'waiting_answer' });

    return { pending, running, waiting, total: pending + running + waiting };
  }

  async resolveRepoPath(repoAlias) {
    const reposBase = process.env.REPOS_BASE || '/home/ubuntu/repos';

    // Handle general/system tasks (clone, setup, etc.)
    if (repoAlias === '_general') {
      return reposBase;
    }

    // Check if it's a registered alias
    const repo = await Repo.findOne({ alias: repoAlias.toLowerCase(), isActive: true });
    if (repo) return repo.path;

    // Check if it's an absolute path
    if (repoAlias.startsWith('/')) {
      return repoAlias;
    }

    // Try repos base path
    return `${reposBase}/${repoAlias}`;
  }

  pause() {
    this.isPaused = true;
    console.log('[TaskRunner] Paused');
  }

  resume() {
    this.isPaused = false;
    console.log('[TaskRunner] Resumed');
  }
}

export default TaskRunner;
