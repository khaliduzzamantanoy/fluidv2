const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Trigger cleanup of the installer
router.post('/cleanup', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (!confirm) {
      return res.status(400).json({ error: 'Confirmation required' });
    }

    // Stop and disable the service
    await execAsync('systemctl stop fluid-installer');
    await execAsync('systemctl disable fluid-installer');
    
    // Remove systemd service file
    await fs.unlink('/etc/systemd/system/fluid-installer.service');
    await execAsync('systemctl daemon-reload');
    
    // Remove Nginx config
    await fs.unlink('/etc/nginx/sites-available/fluid-installer');
    try {
      await fs.unlink('/etc/nginx/sites-enabled/fluid-installer');
    } catch {
      // File might not exist
    }
    await execAsync('systemctl reload nginx');
    
    // Remove installation directory
    await execAsync('rm -rf /opt/fluid');
    
    // Remove temp directory
    await execAsync('rm -rf /tmp/fluid-installer');
    
    // Remove installation script
    await execAsync('rm -f /tmp/fluid-install.sh');
    
    res.json({ 
      success: true, 
      message: 'Fluid installer has been removed from the system. Your deployed application continues to run.' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if cleanup is safe (i.e., deployments exist)
router.get('/check-cleanup-safe', async (req, res) => {
  try {
    const { stdout } = await execAsync('pm2 list --json');
    const processes = JSON.parse(stdout);
    
    const hasDeployments = processes.length > 0;
    
    res.json({ 
      safe: hasDeployments,
      deployments: processes.length,
      message: hasDeployments 
        ? 'Safe to cleanup - deployments will continue running' 
        : 'Warning: No deployments found'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
