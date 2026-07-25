const express = require('express');
const router = express.Router();
const { 
  checkDNS,
  checkDomainPropagation,
  detectSSLProvider
} = require('../services/domainService');

// Check DNS records
router.post('/check-dns', async (req, res) => {
  try {
    const { domain, expectedIP } = req.body;
    const result = await checkDNS(domain, expectedIP);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check domain propagation
router.post('/check-propagation', async (req, res) => {
  try {
    const { domain, expectedIP } = req.body;
    const result = await checkDomainPropagation(domain, expectedIP);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Detect SSL provider
router.post('/detect-ssl', async (req, res) => {
  try {
    const { domain } = req.body;
    const provider = await detectSSLProvider(domain);
    res.json(provider);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
