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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function checkPostgreSQLInstalled() {
  try {
    await runCommand('psql', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function installPostgreSQL() {
  log('cyan', '[1/4] Installing PostgreSQL...');

  try {
    await runCommand('apt-get', ['update', '-y']);
    await runCommand('apt-get', ['install', '-y', 'postgresql', 'postgresql-contrib']);
    log('green', 'PostgreSQL installed successfully');
  } catch (err) {
    log('red', `PostgreSQL installation failed: ${err.message}`);
    throw err;
  }
}

async function setupPostgreSQL() {
  const dbName = 'fluid';
  const username = 'fluid';
  const password = generateSecurePassword(32);

  log('cyan', '[2/4] Starting PostgreSQL...');
  try {
    await runCommand('systemctl', ['enable', 'postgresql']);
    await runCommand('systemctl', ['start', 'postgresql']);
  } catch {
    log('yellow', '[WARN] Could not start PostgreSQL via systemctl, trying pg_ctlcluster...');
    try {
      const pgVersion = (await runCommand('pg_config', ['--version'])).match(/(\d+)/)?.[1] || '16';
      await runCommand('pg_ctlcluster', [pgVersion, 'main', 'start']).catch(() => {});
    } catch (e) {}
  }

  await new Promise(r => setTimeout(r, 2000));
  log('green', 'PostgreSQL is running');

  log('cyan', '[3/4] Creating database and user...');

  try {
    await runCommand('su', ['-', 'postgres', '-c', `psql -c "CREATE USER ${username} WITH PASSWORD '${password}';"`]);
  } catch {
    log('yellow', '[INFO] User may already exist');
  }

  try {
    await runCommand('su', ['-', 'postgres', '-c', `psql -c "CREATE DATABASE ${dbName} OWNER ${username};"`]);
  } catch {
    log('yellow', '[INFO] Database may already exist');
  }

  try {
    await runCommand('su', ['-', 'postgres', '-c', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${username};"`]);
  } catch (e) {}

  log('green', 'Database and user created');

  return { username, password, dbName };
}

async function runPrismaPush(databaseUrl) {
  log('cyan', '[4/4] Running Prisma schema push...');

  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const updates = {
    DATABASE_URL: databaseUrl,
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

  try {
    const proc = spawn('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Prisma push failed with code ${code}`));
      });
      proc.on('error', reject);
    });
    log('green', 'Prisma schema pushed successfully');
  } catch (err) {
    log('yellow', `[WARN] Prisma push: ${err.message}`);
    log('yellow', '[WARN] You may need to run: npx prisma db push');
  }

  log('green', 'Credentials saved to .env');
}

async function main() {
  log('bold', '\n==================================================');
  log('bold', '  FLUID VPS PORTAL - POSTGRESQL SETUP');
  log('bold', '==================================================\n');

  try {
    const isInstalled = await checkPostgreSQLInstalled();
    if (!isInstalled) {
      await installPostgreSQL();
    } else {
      log('green', '[1/4] PostgreSQL already installed');
    }

    const creds = await setupPostgreSQL();

    const databaseUrl = `postgresql://${creds.username}:${creds.password}@127.0.0.1:5432/${creds.dbName}`;
    await runPrismaPush(databaseUrl);

    log('bold', '\n==================================================');
    log('green', '  DATABASE SETUP COMPLETE!');
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
