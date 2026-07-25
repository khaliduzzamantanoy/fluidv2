const express = require('express');
const router = express.Router();
const {
  getDeploymentConfig,
  checkSystemRequirements,
  generateNginxConfig,
  getSupportedFrameworks
} = require('../services/deploymentService');

// Get deployment configuration for a framework
router.get('/config/:framework', async (req, res) => {
  try {
    const { framework } = req.params;
    const config = getDeploymentConfig(framework);
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check system requirements for a framework
router.post('/check-requirements', async (req, res) => {
  try {
    const { framework, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await checkSystemRequirements(framework, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Nginx configuration
router.post('/nginx-config', async (req, res) => {
  try {
    const { domain, projectPath, framework, port } = req.body;
    const config = generateNginxConfig(domain, projectPath, framework, port);
    res.json({ config });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all supported frameworks
router.get('/frameworks', async (req, res) => {
  try {
    const frameworks = getSupportedFrameworks();
    res.json(frameworks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
