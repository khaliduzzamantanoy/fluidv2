#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { ...options, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `Command failed with code ${code}`));
    });
    
    proc.on('error', reject);
  });
}

async function checkMongoDBInstalled() {
  try {
    await runCommand('mongod', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function installMongoDB() {
  log('cyan', '[1/5] Installing MongoDB...');
  
  try {
    await runCommand('apt-get', ['update', '-y']);
    await runCommand('apt-get', ['install', '-y', 'gnupg', 'curl']);
    
    await runCommand('bash', ['-c', 'curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor']);
    
    await runCommand('bash', ['-c', 'echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list']);
    
    await runCommand('apt-get', ['update', '-y']);
    await runCommand('apt-get', ['install', '-y', 'mongodb-org']);
    
    log('green', 'MongoDB installed successfully');
  } catch (err) {
    log('red', `MongoDB installation failed: ${err.message}`);
    throw err;
  }
}

async function configureMongoDB() {
  log('cyan', '[2/5] Configuring MongoDB...');
  
  const configPath = '/etc/mongod.conf';
  let config = fs.readFileSync(configPath, 'utf8');
  
  // Enable authentication
  if (!config.includes('authorization: enabled')) {
    config = config.replace(
      '#security:',
      `security:\n  authorization: enabled`
    );
  }
  
  // Bind to localhost only for security
  config = config.replace(
    'bindIp: 127.0.0.1',
    'bindIp: 127.0.0.1'
  );
  
  fs.writeFileSync(configPath, config);
  log('green', 'MongoDB configured with authentication');
}

async function startMongoDB() {
  log('cyan', '[3/5] Starting MongoDB service...');
  
  try {
    await runCommand('systemctl', ['daemon-reload']);
    await runCommand('systemctl', ['enable', 'mongod']);
    
    // Use restart instead of start - handles both stopped and already-running cases
    try {
      await runCommand('systemctl', ['restart', 'mongod']);
    } catch {
      // Fallback to start if restart fails
      await runCommand('systemctl', ['stop', 'mongod']).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await runCommand('systemctl', ['start', 'mongod']);
    }
    
    // Wait for MongoDB to be ready (use mongo or mongosh)
    const mongoShell = await checkMongoShell();
    for (let i = 0; i < 30; i++) {
      try {
        await runCommand(mongoShell, ['--eval', 'db.adminCommand("ping")', '--quiet']);
        log('green', 'MongoDB is running');
        return;
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw new Error('MongoDB failed to start within 30 seconds');
  } catch (err) {
    log('red', `Failed to start MongoDB: ${err.message}`);
    throw err;
  }
}

async function checkMongoShell() {
  try {
    await runCommand('mongosh', ['--version']);
    return 'mongosh';
  } catch {
    try {
      await runCommand('mongo', ['--version']);
      return 'mongo';
    } catch {
      return 'mongosh';
    }
  }
}

async function createDatabaseAndUser() {
  log('cyan', '[4/5] Creating Fluid database and user...');
  
  const dbName = 'fluid';
  const username = 'fluid_admin';
  const password = generateSecurePassword(32);
  
  const initScript = `
    use admin;
    db.createUser({
      user: "${username}",
      pwd: "${password}",
      roles: [
        { role: "userAdminAnyDatabase", db: "admin" },
        { role: "readWriteAnyDatabase", db: "admin" },
        { role: "dbAdminAnyDatabase", db: "admin" }
      ]
    });
    
    use ${dbName};
    db.createUser({
      user: "${username}",
      pwd: "${password}",
      roles: [
        { role: "readWrite", db: "${dbName}" },
        { role: "dbAdmin", db: "${dbName}" }
      ]
    });
    
    // Create indexes
    db.users.createIndex({ "username": 1 }, { unique: true });
    db.users.createIndex({ "email": 1 }, { unique: true, sparse: true });
    db.projects.createIndex({ "userId": 1 });
    db.projects.createIndex({ "slug": 1, "userId": 1 }, { unique: true });
    db.deployments.createIndex({ "projectId": 1, "createdAt": -1 });
    db.deployments.createIndex({ "status": 1 });
    db.domains.createIndex({ "projectId": 1 });
    db.domains.createIndex({ "domain": 1 }, { unique: true });
    db.serverstats.createIndex({ "timestamp": -1 }, { expireAfterSeconds: 2592000 }); // 30 days
    db.webhookdeliveries.createIndex({ "projectId": 1, "createdAt": -1 });
    db.activitylogs.createIndex({ "userId": 1, "createdAt": -1 });
    db.activitylogs.createIndex({ "projectId": 1, "createdAt": -1 });
  `;
  
  const scriptPath = '/tmp/mongo-init.js';
  fs.writeFileSync(scriptPath, initScript);
  
  try {
    await runCommand('mongosh', [scriptPath]);
    log('green', 'Database and user created');
  } catch (err) {
    log('red', `Failed to create database/user: ${err.message}`);
    throw err;
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
  
  return { username, password, dbName };
}

function generateSecurePassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function saveCredentials(creds) {
  log('cyan', '[5/5] Saving credentials...');
  
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  const updates = {
    MONGODB_URI: `mongodb://${creds.username}:${creds.password}@127.0.0.1:27017/${creds.dbName}?authSource=admin`,
    MONGODB_DATABASE: creds.dbName,
    JWT_SECRET: generateSecurePassword(64),
    ENCRYPTION_KEY: generateSecurePassword(32),
    COOKIE_SECRET: generateSecurePassword(32)
  };
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  log('green', 'Credentials saved to .env');
  
  // Also save to a secure location for reference
  const credsPath = '/root/fluid-credentials.txt';
  const credsContent = `
Fluid VPS Portal - MongoDB Credentials
=====================================
Database: ${creds.dbName}
Username: ${creds.username}
Password: ${creds.password}
Connection String: ${updates.MONGODB_URI}

JWT Secret: ${updates.JWT_SECRET}
Encryption Key: ${updates.ENCRYPTION_KEY}
Cookie Secret: ${updates.COOKIE_SECRET}

IMPORTANT: Save these credentials securely! This file will be deleted after first user setup.
  `.trim();
  
  fs.writeFileSync(credsPath, credsContent);
  log('yellow', `Credentials also saved to ${credsPath} (delete after setup)`);
}

async function main() {
  log('bold', '\n==================================================');
  log('bold', '  FLUID VPS PORTAL - MONGODB SETUP');
  log('bold', '==================================================\n');
  
  try {
    const isInstalled = await checkMongoDBInstalled();
    
    if (!isInstalled) {
      await installMongoDB();
    } else {
      log('green', '[1/5] MongoDB already installed');
    }
    
    await configureMongoDB();
    await startMongoDB();
    const creds = await createDatabaseAndUser();
    await saveCredentials(creds);
    
    log('bold', '\n==================================================');
    log('green', '  MONGODB SETUP COMPLETE!');
    log('bold', '==================================================\n');
    log('cyan', 'Next steps:');
    log('cyan', '1. Run: npm run setup:auth (to create first admin user)');
    log('cyan', '2. Run: npm run build && npm start');
    log('cyan', '3. Access portal at http://your-vps-ip:6776\n');
    
  } catch (err) {
    log('red', `\nSetup failed: ${err.message}`);
    process.exit(1);
  }
}

main();