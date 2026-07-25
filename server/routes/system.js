const express = require('express');
const router = express.Router();
const { 
  getSystemInfo, 
  checkUbuntu, 
  getIPAddress,
  checkDiskSpace,
  checkMemory
} = require('../services/systemService');

// Get system information
router.get('/info', async (req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if system is Ubuntu
router.get('/check-ubuntu', async (req, res) => {
  try {
    const isUbuntu = await checkUbuntu();
    res.json({ isUbuntu });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get IP address
router.get('/ip', async (req, res) => {
  try {
    const ip = await getIPAddress();
    res.json({ ip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check disk space
router.get('/disk', async (req, res) => {
  try {
    const disk = await checkDiskSpace();
    res.json(disk);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check memory
router.get('/memory', async (req, res) => {
  try {
    const memory = await checkMemory();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
