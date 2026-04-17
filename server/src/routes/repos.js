import { Router } from 'express';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import Repo from '../models/Repo.js';

const router = Router();

// List repos
router.get('/', async (req, res) => {
  try {
    const repos = await Repo.find({ isActive: true }).sort({ alias: 1 });
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single repo
router.get('/:alias', async (req, res) => {
  try {
    const repo = await Repo.findOne({ alias: req.params.alias.toLowerCase() });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    res.json(repo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add repo
router.post('/', async (req, res) => {
  try {
    const { alias, path, description, tags } = req.body;

    if (!alias || !path) {
      return res.status(400).json({ error: 'alias and path are required' });
    }

    // Check if path exists
    if (!existsSync(path)) {
      return res.status(400).json({ error: 'Path does not exist' });
    }

    const { deployScript } = req.body;
    const repo = await Repo.create({
      alias: alias.toLowerCase(),
      path,
      description,
      deployScript,
      tags,
      type: req.body.type || 'git'
    });

    res.status(201).json(repo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Alias already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update repo
router.patch('/:alias', async (req, res) => {
  try {
    const { path, description, tags, isActive } = req.body;
    const updates = {};

    // Handle alias change
    if (req.body.alias !== undefined) {
      const newAlias = req.body.alias.toLowerCase().trim();
      if (newAlias !== req.params.alias.toLowerCase()) {
        // Check if new alias already exists
        const existing = await Repo.findOne({ alias: newAlias });
        if (existing) {
          return res.status(400).json({ error: 'Alias already exists' });
        }
        updates.alias = newAlias;
      }
    }

    if (path !== undefined) {
      if (!existsSync(path)) {
        return res.status(400).json({ error: 'Path does not exist' });
      }
      updates.path = path;
    }
    if (description !== undefined) updates.description = description;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.deployScript !== undefined) updates.deployScript = req.body.deployScript;
    if (tags !== undefined) updates.tags = tags;
    if (isActive !== undefined) updates.isActive = isActive;
    if (req.body.type !== undefined) updates.type = req.body.type;

    const repo = await Repo.findOneAndUpdate(
      { alias: req.params.alias.toLowerCase() },
      updates,
      { new: true }
    );

    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    res.json(repo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete repo
router.delete('/:alias', async (req, res) => {
  try {
    const repo = await Repo.findOneAndDelete({ alias: req.params.alias.toLowerCase() });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run deploy script
router.post('/:alias/deploy', async (req, res) => {
  try {
    const repo = await Repo.findOne({ alias: req.params.alias.toLowerCase() });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
    if (!repo.deployScript) return res.status(400).json({ error: 'No deploy script configured for this repo' });

    exec(repo.deployScript, { cwd: repo.path, timeout: 300000 }, (err, stdout, stderr) => {
      res.json({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || '',
        error: err ? err.message : null
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate repo path
router.get('/:alias/validate', async (req, res) => {
  try {
    const repo = await Repo.findOne({ alias: req.params.alias.toLowerCase() });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });

    const valid = existsSync(repo.path);
    res.json({ valid, path: repo.path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
