# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A web dashboard for queuing and running Claude CLI tasks against multiple git repositories on a remote server. You submit a natural-language instruction + repo, and the server spawns `claude` as a subprocess to carry it out. Tasks run one at a time from a MongoDB queue.

## Commands

```bash
# Development (run both server + client concurrently from root)
npm run dev

# Individual
npm run server       # server only (port 3001)
npm run client       # client only (port 5173)

# Production
npm run build        # builds client to client/dist/
npm run start        # starts server (serves built client as static files)
```

**Critical:** The server must be started from the `server/` directory (or via `npm run server` from root) because `import 'dotenv/config'` resolves `.env` relative to `process.cwd()`. Starting `node src/index.js` from the repo root will fail to load env vars.

No test suite exists. Build (`npm run build`) is the only verification step.

## Architecture

### Request Flow

```
Browser → nginx (prod) → Express (port 3001) → TaskRunner singleton
                                               ↓
                                    claude CLI subprocess (one at a time)
                                               ↓
                                    Socket.io broadcasts output to browser
```

In development, Vite proxies `/api/*` to `localhost:3001` so the client at port 5173 talks directly to the server.

### Task Lifecycle

Tasks move through: `pending → running → completed | failed | cancelled`

If Claude's last output line ends with `?`, the runner detects it as a question:
`pending → running → waiting_answer → pending` (re-queued with answer appended to prompt)

The `TaskRunner` (`server/src/services/taskRunner.js`) is a singleton loop that:
1. Polls MongoDB every 2s for the next `pending` task (sorted by priority then `createdAt`)
2. Spawns `claude -p <prompt> --permission-mode bypassPermissions` in the repo's directory
3. Streams stdout/stderr to MongoDB `Log` collection and Socket.io room `task:<taskId>`
4. **Auto-deletes `node_modules`** in the repo directory after every task (success or failure) to conserve disk space

### Socket.io Events

The client subscribes to a task room (`subscribe:task` → joins `task:<taskId>`) to receive:
- `task:output` — streaming stdout/stderr chunks
- `task:completed`, `task:failed`, `task:cancelled`
- `task:question` — when Claude asks a question (pauses task)
- `queue:update` — pending/running/waiting counts

Global events (all connected clients): `task:created`, `question:answered`

### API Routes

All routes under `/api/*` require session auth except `/api/auth/*`.

```
POST   /api/auth/login          password-only session auth
GET    /api/tasks               list tasks (filter: status, repo)
POST   /api/tasks               create task { repo, instruction, priority }
POST   /api/tasks/:id/retry     re-queue a failed task
GET    /api/tasks/:id/logs      ordered log entries for a task
GET    /api/repos               list active repos
POST   /api/repos               add repo { alias, path, deployScript }
PATCH  /api/repos/:alias        update repo (including deployScript)
POST   /api/repos/:alias/deploy run the repo's deployScript via exec()
GET    /api/questions           pending questions
POST   /api/questions/:id/answer answer a question (re-queues task)
POST   /deploy?token=<TOKEN>    webhook — runs /home/ubuntu/deploy.sh
```

### Repo Auto-Scan

On startup, the server scans `REPOS_BASE` (default `/home/ubuntu/repos`) for git directories and auto-registers any not already in MongoDB. Repos can also be added manually via the Repos page.

### Authentication

Single-password session auth. `DASHBOARD_PASSWORD` env var is the password. Sessions expire after 24 hours. The `requireAuth` middleware is applied to all `/api/*` routes except `/api/auth/*`.

## Environment Variables (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3001) |
| `MONGODB_URI` | MongoDB connection string |
| `CLAUDE_PATH` | Path to claude CLI binary |
| `REPOS_BASE` | Base directory for git repos |
| `QUESTION_TIMEOUT_MS` | How long to wait for question answers (default 600000) |
| `WS_CORS_ORIGIN` | Allowed CORS origin for Socket.io |
| `DEPLOY_TOKEN` | Secret token for the `/deploy` webhook |
| `SESSION_SECRET` | Express session secret |
| `DASHBOARD_PASSWORD` | Dashboard login password |

## Critical: Working on This Repo via the Task Manager

If you are running as a Claude task inside the task manager itself (i.e., your CWD is `/home/ubuntu/claude-task-manager`), **do NOT restart PM2 or run `pm2 restart claude-api`**. Doing so will kill the process running you and crash the task.

To deploy changes after editing code:
1. Make your code changes
2. Build the client only: `cd /home/ubuntu/claude-task-manager/client && npm run build && cd ..`
3. Do NOT run `bash ~/deploy.sh` or `pm2 restart` — the deploy button on the dashboard will handle the restart after you finish.

## Production Deployment

Deployed on EC2 at `claude.praneelbora.in`. Managed via PM2 (process name: `claude-api`).

```bash
# Deploy manually
bash ~/deploy.sh   # git pull → npm install → build client → pm2 restart

# Or trigger via webhook
POST /deploy?token=<DEPLOY_TOKEN>
```

PM2 must be started from `server/` as CWD so dotenv finds the `.env` file:
```bash
cd ~/claude-task-manager/server && pm2 start src/index.js --name claude-api
```
