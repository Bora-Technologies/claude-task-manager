import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';
import { connectDB } from './config/db.js';
import taskRoutes from './routes/tasks.js';
import questionRoutes from './routes/questions.js';
import repoRoutes from './routes/repos.js';
import Repo from './models/Repo.js';
import TaskRunner from './services/taskRunner.js';
import setupSocketHandlers from './socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/repos', repoRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// System routes
app.get('/api/system/status', async (req, res) => {
  const taskRunner = app.get('taskRunner');
  res.json({
    isPaused: taskRunner?.isPaused || false,
    currentTask: taskRunner?.currentTask?.taskId || null,
    isRunning: taskRunner?.isRunning || false
  });
});

app.post('/api/system/pause', (req, res) => {
  const taskRunner = app.get('taskRunner');
  if (taskRunner) taskRunner.pause();
  res.json({ success: true });
});

app.post('/api/system/resume', (req, res) => {
  const taskRunner = app.get('taskRunner');
  if (taskRunner) taskRunner.resume();
  res.json({ success: true });
});

// Deploy webhook - auto-deploy on git push
app.post('/deploy', (req, res) => {
  const token = req.query.token;
  const expectedToken = process.env.DEPLOY_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  console.log('[Deploy] Webhook triggered');
  res.json({ status: 'deploying' });

  // Run deploy script asynchronously
  exec('/home/ubuntu/deploy.sh', (error, stdout, stderr) => {
    if (error) {
      console.error('[Deploy] Error:', error.message);
      return;
    }
    console.log('[Deploy] Output:', stdout);
    if (stderr) console.error('[Deploy] Stderr:', stderr);
  });
});

// Serve static React build in production
const clientDistPath = join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(join(clientDistPath, 'index.html'));
});

// Auto-scan repos folder and register any git repos found
async function autoScanRepos() {
  const reposBase = process.env.REPOS_BASE || '/home/ubuntu/repos';

  if (!existsSync(reposBase)) {
    console.log('[AutoScan] Repos folder not found:', reposBase);
    return;
  }

  try {
    const entries = readdirSync(reposBase);

    for (const entry of entries) {
      const fullPath = join(reposBase, entry);

      // Skip if not a directory
      if (!statSync(fullPath).isDirectory()) continue;

      // Skip if not a git repo
      if (!existsSync(join(fullPath, '.git'))) continue;

      // Check if already registered
      const existing = await Repo.findOne({ alias: entry.toLowerCase() });
      if (existing) continue;

      // Auto-register
      await Repo.create({
        alias: entry.toLowerCase(),
        path: fullPath,
        description: 'Auto-detected repo'
      });

      console.log(`[AutoScan] Registered repo: ${entry}`);
    }
  } catch (err) {
    console.error('[AutoScan] Error:', err.message);
  }
}

// Connect to MongoDB and start server
connectDB().then(async () => {
  // Auto-scan and register repos
  await autoScanRepos();

  // Setup socket handlers
  setupSocketHandlers(io);

  // Start task runner
  const taskRunner = new TaskRunner(io);
  app.set('taskRunner', taskRunner);
  io.taskRunner = taskRunner;
  taskRunner.start();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
