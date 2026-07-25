const express = require('express');
const router = express.Router();
const {
  checkPM2,
  installPM2,
  startApp,
  setupStartup,
  getProcessList,
  stopApp,
  restartApp,
  deleteApp,
  getAppLogs
} = require('../services/pm2Service');

// Check if PM2 is installed
router.get('/check', async (req, res) => {
  try {
    const result = await checkPM2();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Install PM2
router.post('/install', async (req, res) => {
  try {
    const { io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await installPM2(ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start application with PM2
router.post('/start', async (req, res) => {
  try {
    const { projectPath, appName, command, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await startApp(projectPath, appName, command, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup PM2 startup
router.post('/startup', async (req, res) => {
  try {
    const { io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await setupStartup(ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get PM2 process list
router.get('/list', async (req, res) => {
  try {
    const result = await getProcessList();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop application
router.post('/stop', async (req, res) => {
  try {
    const { appName, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await stopApp(appName, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart application
router.post('/restart', async (req, res) => {
  try {
    const { appName, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await restartApp(appName, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete application
router.post('/delete', async (req, res) => {
  try {
    const { appName, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await deleteApp(appName, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get application logs
router.get('/logs/:appName', async (req, res) => {
  try {
    const { appName } = req.params;
    const { lines } = req.query;
    const result = await getAppLogs(appName, lines);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
