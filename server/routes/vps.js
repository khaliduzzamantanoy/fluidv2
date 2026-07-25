const express = require('express');
const router = express.Router();
const {
  generateSSHKeyPair,
  connectToVPS,
  executeCommand,
  executeCommandWithOutput,
  getVPSInfo,
  installDependencies,
  setupVPS,
  disconnectVPS
} = require('../services/vpsService');

// Generate SSH key pair for VPS connection
router.post('/generate-keys', async (req, res) => {
  try {
    const keys = generateSSHKeyPair();
    res.json({
      success: true,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      publicKeyOpenSSH: keys.publicKeyOpenSSH
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test VPS connection
router.post('/test-connection', async (req, res) => {
  try {
    const { host, username, password, privateKey, port } = req.body;
    
    const ssh = await connectToVPS({
      host,
      username,
      password,
      privateKey,
      port: port || 22
    });

    // Test connection with simple command
    const result = await executeCommand(ssh, 'echo "Connection successful"');
    
    disconnectVPS(ssh);

    res.json({
      success: true,
      message: 'VPS connection successful',
      testOutput: result.stdout
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get VPS system information
router.post('/info', async (req, res) => {
  try {
    const { host, username, password, privateKey, port } = req.body;
    
    const ssh = await connectToVPS({
      host,
      username,
      password,
      privateKey,
      port: port || 22
    });

    const info = await getVPSInfo(ssh);
    
    disconnectVPS(ssh);

    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Install dependencies on VPS
router.post('/install-deps', async (req, res) => {
  try {
    const { host, username, password, privateKey, port, projectType, framework, io, sessionId } = req.body;
    
    const ssh = await connectToVPS({
      host,
      username,
      password,
      privateKey,
      port: port || 22
    });

    const ioInstance = req.app.get('io');
    
    // Execute with live output
    const onOutput = (data) => {
      if (io && sessionId) {
        ioInstance.to(sessionId).emit('terminal-output', { data });
      }
    };

    const result = await installDependencies(ssh, projectType, framework);
    
    disconnectVPS(ssh);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup VPS for deployment
router.post('/setup', async (req, res) => {
  try {
    const { host, username, password, privateKey, port, projectDir, sshPublicKey } = req.body;
    
    const ssh = await connectToVPS({
      host,
      username,
      password,
      privateKey,
      port: port || 22
    });

    const result = await setupVPS(ssh, {
      projectDir,
      sshPublicKey
    });
    
    disconnectVPS(ssh);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command on VPS
router.post('/execute', async (req, res) => {
  try {
    const { host, username, password, privateKey, port, command, io, sessionId } = req.body;
    
    const ssh = await connectToVPS({
      host,
      username,
      password,
      privateKey,
      port: port || 22
    });

    const ioInstance = req.app.get('io');
    
    let result;
    if (io && sessionId) {
      const onOutput = (data) => {
        ioInstance.to(sessionId).emit('terminal-output', { data });
      };
      result = await executeCommandWithOutput(ssh, command, onOutput);
    } else {
      result = await executeCommand(ssh, command);
    }
    
    disconnectVPS(ssh);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
