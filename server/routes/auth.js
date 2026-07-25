const express = require('express');
const router = express.Router();
const { authenticateWithToken, initiateDeviceFlow, pollDeviceFlow } = require('../services/githubAuth');

// Authenticate with personal access token
router.post('/token', async (req, res) => {
  try {
    const { token } = req.body;
    const result = await authenticateWithToken(token);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Initiate GitHub device flow
router.post('/device/initiate', async (req, res) => {
  try {
    const result = await initiateDeviceFlow();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Poll for device flow completion
router.post('/device/poll', async (req, res) => {
  try {
    const { deviceCode, interval } = req.body;
    const result = await pollDeviceFlow(deviceCode, interval);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
