const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');

const execAsync = promisify(exec);

// Generate a device code for GitHub device authentication
function generateDeviceCode() {
  const deviceCode = crypto.randomBytes(16).toString('hex').substring(0, 8);
  const userCode = crypto.randomBytes(16).toString('hex').substring(0, 8).toUpperCase();
  
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5
  };
}

// Setup GitHub device authentication on VPS
async function setupGitHubDeviceAuth(ssh, githubToken, vpsUsername) {
  try {
    // Create SSH directory on VPS
    await ssh.execCommand(`mkdir -p ~/.ssh`);
    
    // Generate SSH key on VPS
    await ssh.execCommand(`ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""`);
    
    // Get public key from VPS
    const publicKeyResult = await ssh.execCommand(`cat ~/.ssh/id_rsa.pub`);
    const publicKey = publicKeyResult.stdout.trim();
    
    // Add SSH key to GitHub account via GitHub API
    // This would be done by the central server using the user's GitHub token
    // The key would be added as a deploy key for the specific repository
    
    return {
      success: true,
      publicKey: publicKey,
      message: 'SSH key generated on VPS'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Configure git on VPS to use SSH for GitHub operations
async function configureGitSSH(ssh, gitEmail, gitUsername) {
  try {
    await ssh.execCommand(`git config --global user.email "${gitEmail}"`);
    await ssh.execCommand(`git config --global user.name "${gitUsername}"`);
    
    // Configure git to use SSH
    await ssh.execCommand(`git config --global url."git@github.com:".insteadOf "https://github.com/"`);
    
    return {
      success: true,
      message: 'Git configured for SSH'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Add SSH key to GitHub repository as deploy key
async function addDeployKeyToGitHub(githubToken, repoOwner, repoName, publicKey, keyTitle) {
  // This would be called by the central server using GitHub API
  // POST /repos/:owner/:repo/keys
  // {
  //   "title": keyTitle,
  //   "key": publicKey,
  //   "read_only": false
  // }
  
  return {
    success: true,
    message: 'Deploy key would be added via GitHub API'
  };
}

// Test GitHub SSH connection from VPS
async function testGitHubSSH(ssh) {
  try {
    const result = await ssh.execCommand(`ssh -o StrictHostKeyChecking=no -T git@github.com 2>&1 || true`);
    
    if (result.stdout.includes('successfully authenticated') || result.stdout.includes('You have successfully authenticated')) {
      return {
        success: true,
        message: 'GitHub SSH authentication successful'
      };
    } else {
      return {
        success: false,
        message: 'GitHub SSH authentication failed',
        output: result.stdout
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateDeviceCode,
  setupGitHubDeviceAuth,
  configureGitSSH,
  addDeployKeyToGitHub,
  testGitHubSSH
};
