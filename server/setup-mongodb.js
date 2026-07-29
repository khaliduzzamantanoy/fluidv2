#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { ...options, stdio: 'pipe' });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function runCommandSafe(command, args = [], options = {}) {
  return runCommand(command, args, options).catch(() => '');
}

function generateSecurePassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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
  
  // Detect Ubuntu version for correct repo
  const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
  const ubuntuVer = osRelease.match(/VERSION_ID="(\d+)\.\d+"/)?.[1] || '22';
  const repoVersion = ubuntuVer === '24' ? '8.0' : '7.0';
  const ubuntuCodename = ubuntuVer === '24' ? 'noble' : 'jammy';
  
  log('yellow', `[INFO] Ubuntu ${ubuntuVer} detected, using MongoDB ${repoVersion} repo`);
  
  try {
    await runCommand('apt-get', ['update', '-y']);
    await runCommand('apt-get', ['install', '-y', 'gnupg', 'curl']);
    
    // Import MongoDB GPG key
    await runCommandSafe('bash', ['-c', `curl -fsSL https://www.mongodb.org/static/pgp/server-${repoVersion}.asc | gpg -o /usr/share/keyrings/mongodb-server-${repoVersion}.gpg --dearmor --always-trust`]);
    
    // Add MongoDB repo
    const repoLine = `deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${repoVersion}.gpg ] https://repo.mongodb.org/apt/ubuntu ${ubuntuCodename}/mongodb-org/${repoVersion} multiverse`;
    await runCommand('bash', ['-c', `echo "${repoLine}" | tee /etc/apt/sources.list.d/mongodb-org.list`]);
    
    await runCommand('apt-get', ['update', '-y']);
    await runCommand('apt-get', ['install', '-y', 'mongodb-org']);
    
    log('green', 'MongoDB installed successfully');
  } catch (err) {
    log('red', `MongoDB installation failed: ${err.message}`);
    throw err;
  }
}

async function setupMongoDB() {
  const dbName = 'fluid';
  const username = 'fluid_admin';
  const password = generateSecurePassword(32);
  const keyFilePath = '/etc/mongodb-keyfile';

  // Step 1: Generate keyFile
  log('cyan', '[2/5] Generating keyFile for replica set...');
  await runCommand('openssl', ['rand', '-base64', '756']);
  
  // Write keyFile
  const keyFile = await runCommand('openssl', ['rand', '-base64', '756']);
  fs.writeFileSync(keyFilePath, keyFile + '\n');
  fs.chmodSync(keyFilePath, 0o400);
  
  // Find mongodb user
  let mongoUser = 'mongodb';
  try { mongoUser = fs.statSync('/var/lib/mongodb').uid === 0 ? 'root' : 'mongodb'; } catch (e) {}
  
  try { await runCommand('chown', [mongoUser, keyFilePath]); } catch (e) {}
  log('green', 'KeyFile generated');

  // Step 2: Write clean config (keyFile + replSet, NO authorization yet)
  log('cyan', '[3/5] Configuring MongoDB...');
  
  // Check if replication is enabled in existing config
  let hasReplicaSet = false;
  try {
    const existingConfig = fs.readFileSync('/etc/mongod.conf', 'utf8');
    hasReplicaSet = existingConfig.includes('replSetName');
  } catch (e) {}

  const configContent = [
    'storage:',
    '  dbPath: /var/lib/mongodb',
    'systemLog:',
    '  destination: file',
    '  logAppend: true',
    '  path: /var/log/mongodb/mongod.log',
    'net:',
    '  port: 27017',
    '  bindIp: 127.0.0.1',
    'processManagement:',
    '  timeZoneInfo: /usr/share/zoneinfo',
    'security:',
    `  keyFile: ${keyFilePath}`,
    hasReplicaSet ? 'replication:\n  replSetName: "rs0"' : '#replication:\n#  replSetName: "rs0"',
  ].join('\n');
  
  fs.writeFileSync('/etc/mongod.conf', configContent + '\n');
  log('green', 'MongoDB configured (keyFile + replica set, auth disabled)');

  // Step 3: Start MongoDB (keyFile enables internal cluster auth, but user auth is off)
  log('cyan', '[4/5] Starting MongoDB and initializing replica set...');
  try {
    await runCommand('systemctl', ['daemon-reload']);
    await runCommand('systemctl', ['enable', 'mongod']);
    await runCommand('systemctl', ['stop', 'mongod']).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await runCommand('systemctl', ['start', 'mongod']);
  } catch {
    await runCommand('systemctl', ['restart', 'mongod']).catch(() => {});
  }

  // Wait for MongoDB
  let mongoReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await runCommand('mongosh', ['--eval', 'db.adminCommand("ping")', '--quiet']);
      mongoReady = true;
      break;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!mongoReady) throw new Error('MongoDB failed to start');
  log('green', 'MongoDB is running');

  // Init replica set (if not already)
  try {
    await runCommand('mongosh', ['--quiet', '--eval', 'rs.initiate({_id:"rs0", members:[{_id:0,host:"127.0.0.1:27017"}]})']);
    log('yellow', '[INFO] Replica set initialized');
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    log('yellow', '[INFO] Replica set already initialized or skip');
  }

  // Step 4: Create admin user (localhost exception works - no auth enabled)
  log('cyan', '[5/5] Creating database users...');
  
  const initScript = `
    use admin;
    if (db.getUser("${username}") === null) {
      db.createUser({
        user: "${username}",
        pwd: "${password}",
        roles: [ { role: "root", db: "admin" } ]
      });
    }
    use ${dbName};
    if (db.getUser("${username}") === null) {
      db.createUser({
        user: "${username}",
        pwd: "${password}",
        roles: [ { role: "readWrite", db: "${dbName}" }, { role: "dbAdmin", db: "${dbName}" } ]
      });
    }
    // Indexes
    db.users?.createIndex({ "username": 1 }, { unique: true });
    db.users?.createIndex({ "email": 1 }, { unique: true, sparse: true });
    db.projects?.createIndex({ "userId": 1 });
    db.projects?.createIndex({ "slug": 1, "userId": 1 }, { unique: true });
    db.deployments?.createIndex({ "projectId": 1, "createdAt": -1 });
    db.deployments?.createIndex({ "status": 1 });
    db.serverstats?.createIndex({ "timestamp": -1 }, { expireAfterSeconds: 2592000 });
    db.webhookdeliveries?.createIndex({ "projectId": 1, "createdAt": -1 });
    db.activitylogs?.createIndex({ "userId": 1, "createdAt": -1 });
  `;

  const scriptPath = '/tmp/mongo-init.js';
  fs.writeFileSync(scriptPath, initScript);
  
  try {
    const result = await runCommand('mongosh', [scriptPath]);
    log('green', 'Database user created');
  } catch (err) {
    log('yellow', `[WARN] User creation: ${err.message}`);
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }

  // Step 5: Enable authorization in config and restart
  log('cyan', '[6/6] Enabling authentication...');
  
  // Read current config and add authorization
  let config = fs.readFileSync('/etc/mongod.conf', 'utf8');
  if (config.includes('keyFile') && !config.includes('authorization:')) {
    config = config.replace(
      'keyFile:',
      'authorization: enabled\n  keyFile:'
    );
    fs.writeFileSync('/etc/mongod.conf', config);
  }
  
  // Restart MongoDB with auth enabled
  await runCommand('systemctl', ['restart', 'mongod']);
  await new Promise(r => setTimeout(r, 3000));

  // Wait for MongoDB with auth
  for (let i = 0; i < 15; i++) {
    try {
      await runCommand('mongosh', ['-u', username, '-p', password, '--authenticationDatabase', 'admin', '--eval', 'db.adminCommand("ping")', '--quiet']);
      log('green', 'MongoDB authentication verified');
      break;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return { username, password, dbName };
}

async function saveCredentials(creds) {
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

    const creds = await setupMongoDB();
    await saveCredentials(creds);

    log('bold', '\n==================================================');
    log('green', '  MONGODB SETUP COMPLETE!');
    log('bold', '==================================================\n');
    log('cyan', 'Run: npm run setup:auth (to create admin user)');
    log('cyan', 'Then: npm run build && npm start');
    log('cyan', 'Access at http://your-vps-ip:6776\n');

  } catch (err) {
    log('red', `\nSetup failed: ${err.message}`);
    process.exit(1);
  }
}

main();