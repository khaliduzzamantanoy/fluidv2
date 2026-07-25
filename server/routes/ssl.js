const express = require('express');
const router = express.Router();
const { 
  installSSL,
  configureNginx,
  checkSSLStatus
} = require('../services/sslService');

// Install SSL certificate
router.post('/install', async (req, res) => {
  try {
    const { domain, email, provider, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await installSSL(domain, email, provider, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Configure Nginx
router.post('/configure-nginx', async (req, res) => {
  try {
    const { domain, projectPath, port, io, sessionId } = req.body;
    const ioInstance = req.app.get('io');
    const result = await configureNginx(domain, projectPath, port, ioInstance, sessionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check SSL status
router.get('/status/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const status = await checkSSLStatus(domain);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
