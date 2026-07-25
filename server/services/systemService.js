const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execAsync = promisify(exec);

// Get system information
async function getSystemInfo() {
  try {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    const hostname = os.hostname();
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      platform,
      arch,
      release,
      hostname,
      cpus: cpus.length,
      totalMemory,
      freeMemory,
      uptime: os.uptime()
    };
  } catch (error) {
    throw new Error('Failed to get system information');
  }
}

// Check if system is Ubuntu
async function checkUbuntu() {
  try {
    const content = await fs.readFile('/etc/os-release', 'utf8');
    return content.includes('Ubuntu');
  } catch (error) {
    return false;
  }
}

// Get IP address
async function getIPAddress() {
  try {
    // Get local IP
    const interfaces = os.networkInterfaces();
    let localIP = '127.0.0.1';
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
    }

    // Get public IP
    const response = await axios.get('https://api.ipify.org?format=json');
    const publicIP = response.data.ip;

    return {
      local: localIP,
      public: publicIP
    };
  } catch (error) {
    throw new Error('Failed to get IP address');
  }
}

// Check disk space
async function checkDiskSpace() {
  try {
    const { stdout } = await execAsync('df -h /');
    const lines = stdout.split('\n');
    const data = lines[1].split(/\s+/);
    
    return {
      total: data[1],
      used: data[2],
      available: data[3],
      percentage: data[4]
    };
  } catch (error) {
    throw new Error('Failed to check disk space');
  }
}

// Check memory
async function checkMemory() {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      total: Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      used: Math.round(usedMemory / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      free: Math.round(freeMemory / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      percentage: Math.round((usedMemory / totalMemory) * 100) + '%'
    };
  } catch (error) {
    throw new Error('Failed to check memory');
  }
}

module.exports = {
  getSystemInfo,
  checkUbuntu,
  getIPAddress,
  checkDiskSpace,
  checkMemory
};
