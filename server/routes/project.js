const express = require('express');
const router = express.Router();
const { 
  createDirectory, 
  cloneRepository, 
  detectProjectType,
  detectBuildCommands,
  installDependencies,
  parseEnvFile,
  generateSSHKey
} = require('../services/projectService');

// Create project directory
router.post('/directory', async (req, res) => {
  try {
    const { path } = req.body;
    const result = await createDirectory(path);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Clone repository
router.post('/clone', async (req, res) => {
  try {
    const { token, repoUrl, targetDir, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await cloneRepository(token, repoUrl, targetDir, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Detect project type
router.post('/detect-type', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const type = await detectProjectType(projectPath);
    res.json(type);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Detect build commands
router.post('/detect-build', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const commands = await detectBuildCommands(projectPath);
    res.json(commands);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Install dependencies
router.post('/install-deps', async (req, res) => {
  try {
    const { projectPath, projectType, framework, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await installDependencies(projectPath, projectType, framework, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Parse environment file
router.post('/parse-env', async (req, res) => {
  try {
    const { envContent } = req.body;
    const parsed = await parseEnvFile(envContent);
    res.json(parsed);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate SSH key for GitHub
router.post('/ssh-key', async (req, res) => {
  try {
    const { email } = req.body;
    const key = await generateSSHKey(email);
    res.json(key);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
