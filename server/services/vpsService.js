const { NodeSSH } = require('node-ssh');
const crypto = require('crypto');

// Store VPS connections (in production, use database)
const vpsConnections = new Map();

// Generate SSH key pair for VPS connection
function generateSSHKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return {
    publicKey,
    privateKey,
    publicKeyOpenSSH: formatOpenSSHPublicKey(publicKey)
  };
}

function formatOpenSSHPublicKey(pemKey) {
  // Convert PEM to OpenSSH format
  const cleanKey = pemKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\n/g, '')
    .replace(/\r/g, '');
  
  return `ssh-rsa ${cleanKey} fluid-installer`;
}

// Connect to VPS via SSH
async function connectToVPS(vpsConfig) {
  const ssh = new NodeSSH();
  
  try {
    await ssh.connect({
      host: vpsConfig.host,
      port: vpsConfig.port || 22,
      username: vpsConfig.username,
      password: vpsConfig.password,
      privateKey: vpsConfig.privateKey,
      passphrase: vpsConfig.passphrase
    });
    
    return ssh;
  } catch (error) {
    throw new Error(`Failed to connect to VPS: ${error.message}`);
  }
}

// Execute command on VPS
async function executeCommand(ssh, command) {
  try {
    const result = await ssh.execCommand(command);
    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute command with live output streaming
async function executeCommandWithOutput(ssh, command, onOutput) {
  try {
    const result = await ssh.execCommand(command, {
      onStdout: (chunk) => {
        if (onOutput) onOutput(chunk.toString('utf8'));
      },
      onStderr: (chunk) => {
        if (onOutput) onOutput(chunk.toString('utf8'));
      }
    });
    
    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Upload file to VPS
async function uploadFile(ssh, localPath, remotePath) {
  try {
    await ssh.putFile(localPath, remotePath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Download file from VPS
async function downloadFile(ssh, remotePath, localPath) {
  try {
    await ssh.getFile(localPath, remotePath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Check VPS system info
async function getVPSInfo(ssh) {
  try {
    const commands = [
      'uname -a',
      'free -h',
      'df -h',
      'uptime'
    ];

    const results = {};
    for (const cmd of commands) {
      const result = await ssh.execCommand(cmd);
      results[cmd] = result.stdout;
    }

    return {
      success: true,
      info: results
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Install dependencies on VPS
async function installDependencies(ssh, projectType, framework) {
  const commands = {
    nodejs: 'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs',
    python: 'sudo apt-get update && sudo apt-get install -y python3 python3-pip',
    docker: 'curl -fsSL https://get.docker.com | sudo sh',
    nginx: 'sudo apt-get install -y nginx',
    git: 'sudo apt-get install -y git',
    pm2: 'sudo npm install -g pm2'
  };

  const installCommands = [];
  
  if (projectType === 'nodejs' || projectType === 'docker') {
    installCommands.push(commands.nodejs);
  }
  if (projectType === 'python') {
    installCommands.push(commands.python);
  }
  if (projectType === 'docker') {
    installCommands.push(commands.docker);
  }
  
  installCommands.push(commands.git);
  installCommands.push(commands.nginx);
  installCommands.push(commands.pm2);

  const results = [];
  for (const cmd of installCommands) {
    const result = await ssh.execCommand(cmd);
    results.push({
      command: cmd,
      success: result.code === 0,
      output: result.stdout,
      error: result.stderr
    });
  }

  return {
    success: true,
    results
  };
}

// Setup VPS for deployment
async function setupVPS(ssh, config) {
  try {
    // Create project directory
    await ssh.execCommand(`sudo mkdir -p ${config.projectDir}`);
    
    // Setup SSH key for git access
    if (config.sshPublicKey) {
      await ssh.execCommand(`mkdir -p ~/.ssh`);
      await ssh.execCommand(`echo "${config.sshPublicKey}" >> ~/.ssh/authorized_keys`);
    }

    return {
      success: true,
      message: 'VPS setup complete'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Disconnect from VPS
function disconnectVPS(ssh) {
  ssh.dispose();
}

module.exports = {
  generateSSHKeyPair,
  connectToVPS,
  executeCommand,
  executeCommandWithOutput,
  uploadFile,
  downloadFile,
  getVPSInfo,
  installDependencies,
  setupVPS,
  disconnectVPS
};
